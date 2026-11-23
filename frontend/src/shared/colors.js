/* MAP §1 compositing and accessible foreground */
// §1 compositing and accessible foreground
export function blendColor(color,opacity,background){
 const read=hex=>hex.replace('#','').match(/../g).map(v=>parseInt(v,16));
 const fg=read(color),bg=read(background),alpha=Math.max(0,Math.min(1,opacity));
 return '#'+fg.map((v,i)=>Math.round(v*alpha+bg[i]*(1-alpha)).toString(16).padStart(2,'0')).join('');
}
export function foreground(color){
 const channels=color.replace('#','').match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const light=channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
 return (light+.05)/.055 > 1.0/(light+.05)?'#101820':'#f8fafc';
}
