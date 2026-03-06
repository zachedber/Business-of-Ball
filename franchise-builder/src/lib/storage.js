const SAVE_KEY='bob_v3_save';
function ls(){return typeof window!=='undefined'?window.localStorage:null;}
export async function saveGame(state){
  try{const s=ls();if(!s)return{success:false};
  s.setItem(SAVE_KEY,JSON.stringify({...state,updatedAt:new Date().toISOString(),version:'3.0.0'}));
  return{success:true};}catch(e){console.error('Save failed:',e);return{success:false};}
}
export async function loadGame(){
  try{const s=ls();if(!s)return null;const raw=s.getItem(SAVE_KEY);if(!raw)return null;return JSON.parse(raw);}catch{return null;}
}
export async function deleteSave(){try{const s=ls();if(s)s.removeItem(SAVE_KEY);return true;}catch{return false;}}
export function hasSave(){try{return!!ls()?.getItem(SAVE_KEY);}catch{return false;}}
