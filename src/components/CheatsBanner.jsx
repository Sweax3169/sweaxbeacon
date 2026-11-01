import React from 'react'
import { Px } from '../pixel/Pixel.jsx'

// The game said "Unknown or incomplete command": cheats are off in this world,
// or the player is not an operator on this server.
export default function CheatsBanner({ game }) {
  const server = game && game.where === 'server'
  return (
    <div className="banner">
      <Px name="lever" size={32} />
      <div>
        <b>{server ? 'Bu sunucuda operatör değilsin' : 'Bu dünyada hileler kapalı'}</b>
        {server ? (
          <span>Komutlar ancak operatörlere açık. Sunucunun sahibinden <code>op</code> iste.</span>
        ) : (
          <div className="steps">
            Açmak için oyunda: <kbd>Esc</kbd> → <kbd>LAN&rsquo;a aç</kbd> → <kbd>Hilelere izin ver: Açık</kbd> → <kbd>LAN dünyası başlat</kbd>
          </div>
        )}
      </div>
      <span />
    </div>
  )
}
