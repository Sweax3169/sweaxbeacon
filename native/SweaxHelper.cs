// SweaxBeacon helper: the few Windows calls Node cannot make on its own.
//
// It talks JSON lines over stdin/stdout. Each request is {"id":n,"op":"...",...}
// and gets exactly one reply {"id":n,"ok":true,"data":...} or {"id":n,"ok":false,"error":"..."}.
//
//   procs    every java.exe / javaw.exe with its command line and working folder
//   windows  the visible top-level windows of one process
//   fgstate  whether a window is in front, and since when it is not
//   focus    / blur / key / type: window messages to the game window (see "chat input")
//   place    moves a window without activating it (used by the tests)
//   cursor   mouse position and clip rectangle (used by the tests)
//   unclip   lifts any mouse clip rectangle (the tests' safety net)
//   guard    for a while, hands the foreground straight back if a process takes it (tests)
//
// Build: tools/build-helper.cjs (csc.exe from .NET Framework 4, which every
// Windows 10 and 11 PC has). Written in C# 5 because that is what csc 4.x knows.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

static class SweaxHelper
{
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 16 * 1024 * 1024 };
    static readonly object OutLock = new object();
    static TextWriter Out;

    // When each window last stopped being the foreground window (Environment.TickCount).
    static readonly Dictionary<long, int> LostForeground = new Dictionary<long, int>();
    static long CurrentForeground;

    static void Main()
    {
        Out = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };
        var input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));

        var tracker = new Thread(TrackForeground) { IsBackground = true };
        tracker.Start();

        string line;
        while ((line = input.ReadLine()) != null)
        {
            if (line.Trim().Length == 0) continue;
            string copy = line;
            Interlocked.Increment(ref Pending);
            ThreadPool.QueueUserWorkItem(delegate { try { Handle(copy); } finally { Interlocked.Decrement(ref Pending); } });
        }
        // stdin closed: the app quit. Finish what was asked, then leave.
        while (Interlocked.CompareExchange(ref Pending, 0, 0) > 0) Thread.Sleep(20);
    }

    static int Pending;

    static void Handle(string line)
    {
        object id = null;
        try
        {
            var req = Json.Deserialize<Dictionary<string, object>>(line);
            req.TryGetValue("id", out id);
            string op = Str(req, "op");
            object data;
            if (op == "procs") data = Procs();
            else if (op == "windows") data = Windows(Int(req, "pid"));
            else if (op == "fgstate") data = FgState(req);
            else if (op == "focus") data = Focus(req, true);
            else if (op == "blur") data = Focus(req, false);
            else if (op == "key") data = KeyOp(req);
            else if (op == "type") data = TypeOp(req);
            else if (op == "place") data = Place(req);
            else if (op == "cursor") data = Cursor();
            else if (op == "unclip") data = ClipCursor(IntPtr.Zero);
            else if (op == "guard") data = Guard(req);
            else if (op == "ping") data = "pong";
            else throw new Exception("unknown op " + op);
            Reply(id, true, data, null);
        }
        catch (Exception e)
        {
            Reply(id, false, null, e.Message);
        }
    }

    static void Reply(object id, bool ok, object data, string error)
    {
        var msg = new Dictionary<string, object>();
        msg["id"] = id;
        msg["ok"] = ok;
        if (ok) msg["data"] = data; else msg["error"] = error;
        string text = Json.Serialize(msg);
        lock (OutLock) Out.WriteLine(text);
    }

    static string Str(Dictionary<string, object> d, string k)
    {
        object v;
        return d.TryGetValue(k, out v) && v != null ? Convert.ToString(v) : null;
    }

    static int Int(Dictionary<string, object> d, string k)
    {
        object v;
        return d.TryGetValue(k, out v) && v != null ? Convert.ToInt32(v) : 0;
    }

    // ------------------------------------------------------------------ processes

    static List<object> Procs()
    {
        var list = new List<object>();
        foreach (string name in new[] { "java", "javaw" })
        {
            foreach (var p in Process.GetProcessesByName(name))
            {
                var info = new Dictionary<string, object>();
                info["pid"] = p.Id;
                info["name"] = name + ".exe";
                try { info["started"] = p.StartTime.ToUniversalTime().ToString("o"); } catch { }
                string cmd = null, cwd = null, exe = null;
                ReadProcessParameters(p.Id, out cmd, out cwd, out exe);
                info["cmd"] = cmd;
                info["cwd"] = cwd;
                info["exe"] = exe;
                list.Add(info);
                p.Dispose();
            }
        }
        return list;
    }

    // Reads the command line, current folder and image path from the process
    // environment block. Works for processes of the same user without admin
    // rights; 64-bit targets only (every current Minecraft runtime is 64-bit).
    static void ReadProcessParameters(int pid, out string cmd, out string cwd, out string exe)
    {
        cmd = cwd = exe = null;
        IntPtr h = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);
        if (h == IntPtr.Zero) return;
        try
        {
            var pbi = new PROCESS_BASIC_INFORMATION();
            int ret;
            if (NtQueryInformationProcess(h, 0, ref pbi, Marshal.SizeOf(pbi), out ret) != 0) return;
            IntPtr parameters = ReadPtr(h, pbi.PebBaseAddress + 0x20);
            if (parameters == IntPtr.Zero) return;
            cwd = ReadUnicodeString(h, parameters + 0x38);
            exe = ReadUnicodeString(h, parameters + 0x60);
            cmd = ReadUnicodeString(h, parameters + 0x70);
        }
        catch { }
        finally { CloseHandle(h); }
    }

    static IntPtr ReadPtr(IntPtr h, IntPtr addr)
    {
        var buf = new byte[8];
        IntPtr read;
        if (!ReadProcessMemory(h, addr, buf, buf.Length, out read)) return IntPtr.Zero;
        return new IntPtr(BitConverter.ToInt64(buf, 0));
    }

    static string ReadUnicodeString(IntPtr h, IntPtr addr)
    {
        var head = new byte[16];
        IntPtr read;
        if (!ReadProcessMemory(h, addr, head, head.Length, out read)) return null;
        int len = BitConverter.ToUInt16(head, 0);
        var buffer = new IntPtr(BitConverter.ToInt64(head, 8));
        if (len == 0 || buffer == IntPtr.Zero) return "";
        var text = new byte[len];
        if (!ReadProcessMemory(h, buffer, text, len, out read)) return null;
        return Encoding.Unicode.GetString(text);
    }

    // ------------------------------------------------------------------ windows

    static List<object> Windows(int pid)
    {
        var list = new List<object>();
        EnumWindows(delegate (IntPtr hwnd, IntPtr lp)
        {
            uint owner;
            GetWindowThreadProcessId(hwnd, out owner);
            if (owner != pid || !IsWindowVisible(hwnd)) return true;
            var cls = new StringBuilder(256);
            GetClassName(hwnd, cls, cls.Capacity);
            var title = new StringBuilder(512);
            GetWindowText(hwnd, title, title.Capacity);
            RECT r;
            GetWindowRect(hwnd, out r);
            var w = new Dictionary<string, object>();
            w["hwnd"] = hwnd.ToInt64();
            w["cls"] = cls.ToString();
            w["title"] = title.ToString();
            w["iconic"] = IsIconic(hwnd);
            w["foreground"] = GetForegroundWindow() == hwnd;
            w["rect"] = new[] { r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top };
            list.Add(w);
            return true;
        }, IntPtr.Zero);
        return list;
    }

    static object Place(Dictionary<string, object> req)
    {
        var hwnd = new IntPtr(Convert.ToInt64(req["hwnd"]));
        object bottom;
        bool toBottom = req.TryGetValue("bottom", out bottom) && Convert.ToBoolean(bottom);
        SetWindowPos(hwnd, toBottom ? new IntPtr(1) /* HWND_BOTTOM */ : IntPtr.Zero, Int(req, "x"), Int(req, "y"), 0, 0,
            SWP_NOSIZE | SWP_NOACTIVATE | (toBottom ? 0 : SWP_NOZORDER));
        object min;
        if (req.TryGetValue("minimize", out min) && Convert.ToBoolean(min)) ShowWindow(hwnd, 7 /* SW_SHOWMINNOACTIVE */);
        return true;
    }

    // Where the mouse is and whether something has fenced it in; the tests use
    // it to prove the chat link never touches the player's mouse.
    static object Cursor()
    {
        POINT p;
        GetCursorPos(out p);
        RECT clip;
        GetClipCursor(out clip);
        var res = new Dictionary<string, object>();
        res["pos"] = new[] { p.X, p.Y };
        res["clip"] = new[] { clip.Left, clip.Top, clip.Right, clip.Bottom };
        res["foreground"] = GetForegroundWindow().ToInt64();
        res["guardHits"] = GuardHits;
        return res;
    }

    // Test safety net: a freshly started game may get the foreground (Windows
    // allows it once the PC has been idle for a while, and picks the next window
    // when the active one closes). For `ms` milliseconds, whenever a window of
    // `pid` is the foreground, the last other foreground window gets it back,
    // any mouse clip is lifted and the mouse goes back to where it was.
    static int GuardHits;
    static object Guard(Dictionary<string, object> req)
    {
        int pid = Int(req, "pid");
        int ms = Int(req, "ms");
        var t = new Thread(delegate ()
        {
            int end = Environment.TickCount + ms;
            IntPtr lastFg = GetForegroundWindow();
            POINT lastPos;
            GetCursorPos(out lastPos);
            while (Environment.TickCount - end < 0)
            {
                IntPtr fg = GetForegroundWindow();
                uint owner;
                GetWindowThreadProcessId(fg, out owner);
                if (owner != pid)
                {
                    if (fg != IntPtr.Zero) lastFg = fg;
                    GetCursorPos(out lastPos);
                }
                else
                {
                    SetForegroundWindow(lastFg);
                    SetWindowPos(fg, new IntPtr(1) /* HWND_BOTTOM */, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE);
                    ClipCursor(IntPtr.Zero);
                    SetCursorPos(lastPos.X, lastPos.Y);
                    Interlocked.Increment(ref GuardHits);
                }
                Thread.Sleep(3);
            }
        }) { IsBackground = true };
        t.Start();
        return true;
    }

    static void TrackForeground()
    {
        while (true)
        {
            long fg = GetForegroundWindow().ToInt64();
            if (fg != CurrentForeground)
            {
                lock (LostForeground) LostForeground[CurrentForeground] = Environment.TickCount;
                CurrentForeground = fg;
            }
            Thread.Sleep(50);
        }
    }

    // ------------------------------------------------------------------ chat input
    //
    // Window messages posted to the game window only: nothing goes through the
    // system keyboard, the game is not brought to the front and the mouse is
    // never moved. The order (focus, Esc, chat key, text, Enter, Esc, blur) is
    // decided by electron/mc/links.cjs, which watches the game's log between
    // steps; see the comment on ChatLink there.

    const int WM_SETFOCUS = 0x0007, WM_KILLFOCUS = 0x0008, WM_KEYDOWN = 0x0100, WM_KEYUP = 0x0101, WM_CHAR = 0x0102;

    static IntPtr Hwnd(Dictionary<string, object> req)
    {
        var hwnd = new IntPtr(Convert.ToInt64(req["hwnd"]));
        if (!IsWindow(hwnd)) throw new Exception("window-gone");
        return hwnd;
    }

    // Is the window in front, and how long ago did it stop being in front (-1: unknown).
    static object FgState(Dictionary<string, object> req)
    {
        var hwnd = Hwnd(req);
        var res = new Dictionary<string, object>();
        res["foreground"] = GetForegroundWindow() == hwnd;
        int lost;
        bool known;
        lock (LostForeground) known = LostForeground.TryGetValue(hwnd.ToInt64(), out lost);
        res["since"] = known ? Environment.TickCount - lost : -1;
        return res;
    }

    static object Focus(Dictionary<string, object> req, bool on)
    {
        var hwnd = Hwnd(req);
        PostMessage(hwnd, on ? WM_SETFOCUS : WM_KILLFOCUS, IntPtr.Zero, IntPtr.Zero);
        return true;
    }

    static object KeyOp(Dictionary<string, object> req)
    {
        var hwnd = Hwnd(req);
        int scan = Int(req, "scan");
        int vk = Int(req, "vk");
        if (vk == 0) vk = (int)MapVirtualKey((uint)scan, 3 /* MAPVK_VSC_TO_VK_EX */);
        int down = 1 | ((scan & 0xff) << 16) | ((scan & 0x100) != 0 ? 1 << 24 : 0);
        int up = down | (1 << 30) | (1 << 31);
        PostMessage(hwnd, WM_KEYDOWN, new IntPtr(vk), new IntPtr(down));
        Thread.Sleep(25);
        PostMessage(hwnd, WM_KEYUP, new IntPtr(vk), new IntPtr(up));
        return true;
    }

    static object TypeOp(Dictionary<string, object> req)
    {
        var hwnd = Hwnd(req);
        foreach (char c in Str(req, "text") ?? "") PostMessage(hwnd, WM_CHAR, new IntPtr(c), new IntPtr(1));
        return true;
    }

    // ------------------------------------------------------------------ Win32

    const int PROCESS_QUERY_INFORMATION = 0x0400, PROCESS_VM_READ = 0x0010;
    const uint SWP_NOSIZE = 0x0001, SWP_NOMOVE = 0x0002, SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010;

    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_BASIC_INFORMATION
    {
        public IntPtr Reserved1;
        public IntPtr PebBaseAddress;
        public IntPtr Reserved2a;
        public IntPtr Reserved2b;
        public IntPtr UniqueProcessId;
        public IntPtr Reserved3;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    struct POINT { public int X, Y; }

    delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);

    [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int cls, ref PROCESS_BASIC_INFORMATION pbi, int len, out int ret);
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(int access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, int size, out IntPtr read);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder sb, int max);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder sb, int max);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT r);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool PostMessage(IntPtr hwnd, int msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint type);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern bool GetClipCursor(out RECT r);
    [DllImport("user32.dll")] static extern bool ClipCursor(IntPtr r);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int cmd);
}
