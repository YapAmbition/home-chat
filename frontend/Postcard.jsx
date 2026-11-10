import React from 'react';

function Tree({x,y,s=1}){
  return <g transform={`translate(${x} ${y}) scale(${s})`}><path fill="#976947" d="M-4 0h8v20h-8z"/><path fill="#599376" d="M0-47Q-4-48-10-35l-14 22q-2 6 8 6l-9 12q-3 6 7 7h37q9-1 5-7L15-7q11 1 8-5L8-37Q3-47 0-47Z"/><path fill="none" stroke="#7aaa83" strokeWidth="3" strokeLinecap="round" d="m-6-23 6-3m-10 22 8-3"/></g>
}
export default function Postcard(){
  return <svg className="postcard" viewBox="0 0 480 222" aria-hidden="true">
    <defs><pattern id="dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".65" fill="#667d68" opacity=".2"/></pattern></defs>
    <rect width="480" height="222" rx="12" fill="#d7ece1"/>
    <circle cx="366" cy="52" r="22" fill="#ffe3a0"/>
    <g fill="#fffcdf"><path d="M35 58q1-10 12-8 5-17 18-7 9-4 15 6 13-2 14 9Z"/><path d="M262 39q3-7 11-6 7-15 18-4 10-1 14 10Z"/></g>
    <path d="M0 128q51-13 100 0t92-1 136-3 152-1v99H0Z" fill="#98cebe"/>
    <g fill="none" stroke="#e6f5df" strokeWidth="3" strokeLinecap="round"><path d="M16 151h30m350-5h34m-68 54h36m-307 4h29m278-32h12m-364 6h13m146 27h42"/></g>
    <path d="M60 162q9-22 70-27l143-8q76 2 104 26 16 15-12 23-71 20-179 14-90-5-121-15-12-5-5-13" fill="#edd49c"/>
    <path d="M66 157q17-24 85-30 96-10 163 0 41 6 54 25-15 17-98 20-122 7-204-15" fill="#a6c887"/>
    <Tree x={119} y={121} s={1.12}/><Tree x={91} y={139} s={.72}/><Tree x={306} y={122} s={1.05}/><Tree x={331} y={137} s={.68}/>
    <path d="M193 145q22 2 40-1 5 10 30 13 19 4 27 13l-50 3q1-11-29-15-19-4-18-13" fill="#e5cea0"/>
    <path d="M155 94l51-49 56 44v58l-105-2Z" fill="#fff1c7"/><path d="M246 89l21-1v58l-21 1Z" fill="#e4c99d"/>
    <path d="M233 47h14v32h-14z" fill="#b07558"/><path d="m145 95 48-53q5-5 12-5l24 1 47 49q4 6-1 8h-28l-43-41-49 48Z" fill="#cd795a"/><path d="m205 40 47 50h17l-46-50Z" fill="#df9872"/>
    <path d="M198 146v-30q0-14 14-14t14 14v30" fill="#78a391"/><circle cx="219" cy="126" r="2" fill="#fff2bd"/>
    <rect x="166" y="104" width="22" height="23" rx="3" fill="#86765a"/><path d="M169 107h16v16h-16z" fill="#b1d8c4"/><path d="M177 107v16m-8-8h16" stroke="#ffefc6" strokeWidth="2"/>
    <rect x="194" y="73" width="23" height="16" rx="3" fill="#fffbdd" stroke="#988569" strokeWidth="2"/><path d="m195 75 10 8 11-8" fill="none" stroke="#988569" strokeWidth="2"/>
    <path d="M271 132h5v27h-5z" fill="#8a7354"/><rect x="261" y="117" width="23" height="18" rx="6" fill="#d58063"/><path d="M265 123h13" stroke="#865a47" strokeWidth="2.5"/>
    <g fill="#fff4cb">{[[126,155],[139,150],[317,158],[105,146],[293,148]].map(([x,y])=><g key={x}><circle cx={x} cy={y} r="3.4"/><circle cx={x} cy={y} r="1.2" fill="#dfa663"/></g>)}</g>
    <rect width="480" height="222" rx="12" fill="url(#dots)"/>
  </svg>
}
