// ============================================================
// NARRATIVE ENGINE — Procedural + optional Claude API
// ============================================================
let apiKey=null;
export function setNarrativeApiKey(k){apiKey=k;}
export function hasNarrativeApi(){return!!apiKey;}
function pick(a){return a[Math.floor(Math.random()*a.length)];}

async function callClaude(prompt,mt=800){
  if(!apiKey)return null;
  try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:mt,messages:[{role:'user',content:prompt}]})});
    if(!r.ok)return null;const d=await r.json();return d.content?.[0]?.text||null;
  }catch{return null;}
}

export async function generateSeasonRecap(f){
  if(hasNarrativeApi()){const r=await callClaude(`Sports journalist: 3-sentence recap for ${f.city} ${f.name}, ${f.wins}-${f.losses}. Quality ${f.rosterQuality}/100, fans ${f.fanRating}/100, profit $${f.finances.profit}M. ${f.economyCycle==='boom'?'City economy booming.':f.economyCycle==='recession'?'City in recession.':''} Broadcast style, no preamble.`,300);if(r)return r;}
  const wp=f.wins/(f.wins+f.losses),rec=`${f.wins}-${f.losses}`;
  if(wp>0.65)return pick([`The ${f.city} ${f.name} dominated with a commanding ${rec} record. Championship aspirations are sky-high.`,`A season for the ages. The ${f.name} posted ${rec} and look unstoppable.`]);
  if(wp>0.45)return pick([`The ${f.name} had a solid ${rec} campaign. The core is there but pieces are missing.`,`A competitive ${rec} record keeps ${f.city} in the conversation.`]);
  return pick([`A tough ${rec} record for the ${f.city} ${f.name}. A high draft pick awaits.`,`Bottom of the standings at ${rec}. Major changes needed.`]);
}

export async function generateGMGrade(f){
  const wp=f.wins/(f.wins+f.losses),pr=f.finances.profit;
  if(wp>0.65&&pr>0)return{grade:'A',analysis:'Outstanding. Winning and profitable.'};
  if(wp>0.55)return{grade:'B',analysis:'Solid management. Competitive and balanced.'};
  if(wp>0.4)return{grade:'C',analysis:'Middling results. Need clearer direction.'};
  return{grade:'D',analysis:'Rough season. Major changes needed.'};
}

export async function generateDynastyNarrative(f){
  const h=f.history.slice(-3);const tw=h.reduce((s,x)=>s+x.wins,0),tl=h.reduce((s,x)=>s+x.losses,0);
  const avg=tw/(tw+tl);
  if(avg>0.65)return{era:'The Golden Dynasty',narrative:`Dominance: ${tw}-${tl} combined. One of the greatest stretches in franchise history.`};
  if(avg>0.5)return{era:'The Contention Years',narrative:`Competitive at ${tw}-${tl}. The window is open but greatness eludes.`};
  if(avg>0.35)return{era:'The Turbulent Years',narrative:`Challenging at ${tw}-${tl}. Reload or rebuild?`};
  return{era:'The Rebuild Era',narrative:`Dark times at ${tw}-${tl}. Every dynasty starts somewhere.`};
}

export async function generateOffseasonEvents(f){
  return[
    {id:'gala',title:'Community Gala',description:`The ${f.city} ${f.name} can host an awards gala.`,choices:[{label:'Lavish event',cost:3,communityBonus:8,mediaBonus:3},{label:'Modest',cost:1,communityBonus:3},{label:'Skip',communityBonus:-5}]},
    {id:'stadium',title:'Stadium Report',description:`Stadium at ${f.stadiumCondition}% condition.`,choices:[{label:'Major fix',cost:15,stadiumBonus:20},{label:'Patch',cost:5,stadiumBonus:8},{label:'Defer',stadiumBonus:-5}]},
    {id:'sponsor',title:'Sponsorship Offer',description:`A corporation wants to partner.`,choices:[{label:'Accept',revenue:Math.round(f.market*0.08)},{label:'Negotiate',revenue:Math.round(f.market*0.12),risk:0.4},{label:'Decline'}]},
    {id:'youth',title:'Youth Program',description:'City wants a youth sports academy.',choices:[{label:'Fund',cost:5,communityBonus:12},{label:'Partial',cost:2,communityBonus:5},{label:'Pass',communityBonus:-2}]},
  ].sort(()=>Math.random()-0.5).slice(0,2+Math.floor(Math.random()*2));
}
