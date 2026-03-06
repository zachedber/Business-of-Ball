'use client';
import{useState,useEffect,useCallback,useMemo,useRef}from'react';
import{initializeLeague,createPlayerFranchise,simulateFullSeason,generateDraftProspects,draftPlayer,generateFreeAgents,calculateCapSpace,calculateValuation,projectRevenue,rand,pick,clamp,generateId,generateCoachCandidates,fireCoach,hireCoach,genPressConference,generateStakeOffers,calcStakeIncome,genRivalryEvent,maxLoan,takeLoan,repayDebt,GM_TIERS,getGMTier,generateNamingRightsOffer,acceptNamingRights,generateCBAEvent,generateNewspaper}from'@/lib/engine';
import{NGL_TEAMS,ABL_TEAMS,MARKET_TIERS,getMarketTier,getMarketTierInfo,UPGRADE_COSTS,STARTING_CASH}from'@/data/leagues';
import{saveGame,loadGame,deleteSave}from'@/lib/storage';
import{generateSeasonRecap,generateGMGrade,generateDynastyNarrative,generateOffseasonEvents,setNarrativeApiKey,hasNarrativeApi}from'@/lib/narrative';

/* ======== TICKER ======== */
function Ticker({lt,fr,season}){
  const items=useMemo(()=>{if(!lt)return['BUSINESS OF BALL — MORE FEATURES COMING SOON'];
    const m=[`SEASON ${season||1}`];[...(lt.ngl||[])].sort((a,b)=>b.wins-a.wins).slice(0,2).forEach(t=>m.push(`NGL: ${t.city} ${t.name} ${t.wins}-${t.losses}`));
    [...(lt.abl||[])].sort((a,b)=>b.wins-a.wins).slice(0,2).forEach(t=>m.push(`ABL: ${t.city} ${t.name} ${t.wins}-${t.losses}`));
    fr?.forEach(f=>m.push(`YOUR TEAM: ${f.city} ${f.name} ${f.wins}-${f.losses}`));return m;},[lt,fr,season]);
  const txt=items.join('   ///   ');
  return<div className="ticker-bar"><div className="ticker-scroll"><span>{txt}   ///   {txt}</span></div></div>;
}

/* ======== NAV ======== */
function Nav({screen,setScreen,fr,gmRep,cash}){
  const tier=getGMTier(gmRep);
  return(<nav className="nav-bar">
    <div className="nav-top">
      <h1 className="font-display" style={{fontSize:'1rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer'}} onClick={()=>setScreen(fr.length>0?'portfolio':'intro')}>Business of Ball</h1>
      <div className="nav-stats">
        {fr.length>0&&<>
          <div style={{textAlign:'right'}}><span className="stat-label">Cash</span><div className="stat-value" style={{fontSize:'0.8rem',color:cash>5?'var(--green)':cash>0?'var(--amber)':'var(--red)'}}>${Math.round(cash*10)/10}M</div></div>
          <div style={{textAlign:'right'}}><span className="stat-label">{tier.badge}</span><div className="stat-value" style={{fontSize:'0.7rem'}}>{gmRep}</div></div>
        </>}
        <button className="tab-btn" onClick={()=>setScreen('settings')} style={{fontSize:'0.6rem'}}>⚙</button>
      </div>
    </div>
    {fr.length>0&&<div className="nav-links">
      {[['portfolio','Empire'],['dashboard','Team'],['league','League'],['market','Market']].map(([s,l])=>(
        <button key={s} className="tab-btn" onClick={()=>setScreen(s)} style={screen===s?{color:'var(--red)',fontWeight:700}:{}}>{l}</button>
      ))}
    </div>}
  </nav>);
}

/* ======== INTRO ======== */
function Intro({onNew,onLoad,hasSv}){
  return(<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'75vh',padding:'30px 16px',textAlign:'center'}}>
    <h1 className="font-display" style={{fontSize:'clamp(2rem,8vw,3.5rem)',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Business of Ball</h1>
    <div style={{width:60,height:3,background:'var(--red)',margin:'8px auto 12px'}}/>
    <p className="font-body" style={{fontSize:'clamp(0.85rem,3vw,1.05rem)',color:'var(--ink-soft)',maxWidth:460,lineHeight:1.6,marginBottom:28}}>Build a sports empire. Manage franchises across a football league and a basketball league. Draft, negotiate, compete.</p>
    <p className="font-mono" style={{fontSize:'0.65rem',color:'var(--ink-faint)',marginBottom:20}}>More features coming soon</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
      <button className="btn-gold" onClick={onNew}>New Empire</button>
      {hasSv&&<button className="btn-secondary" onClick={onLoad}>Continue</button>}
    </div>
  </div>);
}

/* ======== SETUP ======== */
function Setup({onCreate}){
  const[lg,setLg]=useState(null);const[tier,setTier]=useState(null);const[team,setTeam]=useState(null);
  const teams=lg==='ngl'?NGL_TEAMS:lg==='abl'?ABL_TEAMS:[];
  const tg=useMemo(()=>{const g={};teams.forEach(t=>{const ti=getMarketTier(t.market);if(!g[ti])g[ti]=[];g[ti].push(t);});return g;},[teams]);
  return(<div style={{maxWidth:750,margin:'0 auto',padding:'30px 16px'}}>
    <h2 className="font-display section-header" style={{fontSize:'1.3rem'}}>Choose Your Sport</h2>
    <div style={{display:'flex',gap:12,marginBottom:28}}>
      {[['ngl','NGL','Football League — 32 teams','🏈'],['abl','ABL','Basketball League — 30 teams','🏀']].map(([id,nm,desc,em])=>(
        <button key={id} className={lg===id?'btn-primary':'btn-secondary'} onClick={()=>{setLg(id);setTeam(null);setTier(null);}} style={{flex:1,padding:'14px 16px',textAlign:'left'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:'1.4rem'}}>{em}</span><div><div className="font-display" style={{fontSize:'1.1rem'}}>{nm}</div><div className="font-body" style={{fontSize:'0.75rem',textTransform:'none',letterSpacing:0,fontWeight:400,marginTop:2}}>{desc}</div></div></div>
        </button>))}
    </div>
    {lg&&<>
      <h3 className="font-display section-header" style={{fontSize:'1.1rem'}}>Select Market Tier</h3>
      <p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-muted)',marginBottom:14}}>New GMs start in mid, small, or budget markets.</p>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20}}>
        {Object.entries(MARKET_TIERS).map(([t,info])=>{const ti=Number(t);const locked=![3,4,5].includes(ti);const ct=tg[ti]?.length||0;
          return(<button key={t} onClick={()=>{if(!locked){setTier(ti);setTeam(null);}}} disabled={locked} className="card" style={{padding:'10px 14px',cursor:locked?'not-allowed':'pointer',textAlign:'left',display:'flex',justifyContent:'space-between',alignItems:'center',border:tier===ti?`2px solid ${info.color}`:'1px solid var(--cream-darker)',opacity:locked?0.4:1}}>
            <div><div style={{display:'flex',alignItems:'center',gap:6}}><span className="font-display" style={{fontSize:'0.85rem',fontWeight:700,color:info.color}}>TIER {t} — {info.label}</span>{locked&&<span className="badge badge-ink" style={{fontSize:'0.55rem'}}>LOCKED</span>}</div>
              <div className="font-body" style={{fontSize:'0.7rem',color:'var(--ink-muted)',marginTop:1}}>{info.desc}</div></div>
            <div style={{textAlign:'right'}}><span className="font-mono" style={{fontSize:'0.7rem',color:'var(--ink-muted)'}}>{ct} teams</span>{STARTING_CASH[ti]&&<div className="font-mono" style={{fontSize:'0.6rem',color:'var(--green)'}}>${STARTING_CASH[ti]}M</div>}</div>
          </button>);})}
      </div>
      {tier&&tg[tier]&&<><h3 className="font-display section-header" style={{fontSize:'1rem'}}>Pick Franchise</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:6,marginBottom:20}}>
          {tg[tier].map(t=>(<button key={t.id} onClick={()=>setTeam(t)} className="card" style={{padding:'10px 12px',cursor:'pointer',textAlign:'left',border:team?.id===t.id?'2px solid var(--red)':'1px solid var(--cream-darker)',background:team?.id===t.id?'#fef5f5':'var(--cream)'}}>
            <div className="font-display" style={{fontSize:'0.85rem',fontWeight:600}}>{t.city} {t.name}</div>
            <div className="font-mono" style={{fontSize:'0.6rem',color:'var(--ink-muted)'}}>Market {t.market} · {t.division}</div>
          </button>))}
        </div></>}
      {team&&<div style={{textAlign:'center',marginTop:12}}>
        <p className="font-body" style={{fontSize:'0.95rem',marginBottom:14}}><strong>{team.city} {team.name}</strong> <span className="font-mono" style={{fontSize:'0.7rem',color:MARKET_TIERS[tier]?.color}}>T{tier} · ${STARTING_CASH[tier]}M</span></p>
        <button className="btn-gold" onClick={()=>onCreate(team,lg)}>Launch Franchise</button>
      </div>}
    </>}
  </div>);
}

/* ======== MINI SVG CHART ======== */
function MiniChart({data,width=280,height=80,color='var(--red)'}){
  if(!data||data.length<2)return null;
  const max=Math.max(...data);const min=Math.min(...data);const range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-(((v-min)/range)*height*0.8+height*0.1)}`).join(' ');
  return(<svg width={width} height={height} style={{display:'block'}}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
}

/* ======== DASHBOARD ======== */
function Dashboard({fr,setFr,onSim,simming,recap,grade,events,onResolve,pressConf,onPressConf,newspaper,cbaEvent,onCBA,namingOffer,onNaming}){
  const[tab,setTab]=useState('home');
  const cap=useMemo(()=>calculateCapSpace(fr),[fr]);const val=useMemo(()=>calculateValuation(fr),[fr]);
  const gmTier=getGMTier(fr.mediaRep||50);
  return(<div style={{maxWidth:960,margin:'0 auto',padding:'12px 12px'}}>
    <div className="card-elevated scoreboard" style={{marginBottom:12}}>
      <div>
        <h2 className="font-display" style={{fontSize:'clamp(1.1rem,4vw,1.5rem)',fontWeight:700,textTransform:'uppercase'}}>{fr.city} {fr.name}</h2>
        <div className="font-mono" style={{fontSize:'0.65rem',color:'var(--ink-muted)'}}>{fr.league==='ngl'?'🏈 NGL':'🏀 ABL'} · S{fr.season||1} · {fr.coach.name} {fr.economyCycle==='boom'?'📈':''}{ fr.economyCycle==='recession'?'📉':''}</div>
      </div>
      <div className="scoreboard-stats">
        {[['Record',`${fr.wins}-${fr.losses}`],['Rank',`#${fr.leagueRank||'—'}`,'var(--red)'],['Value',`$${val}M`],['Cash',`$${Math.round((fr.cash||0)*10)/10}M`,(fr.cash||0)>5?'var(--green)':'var(--red)']].map(([l,v,c])=>(
          <div key={l} style={{textAlign:'center',padding:'4px 0'}}><div className="stat-label">{l}</div><div className="font-display" style={{fontSize:'1.1rem',fontWeight:700,color:c||'var(--ink)'}}>{v}</div></div>))}
      </div>
    </div>
    <div className="tab-nav" style={{marginBottom:12}}>
      {['home','roster','draft','coach','biz','facilities','legacy','history'].map(t=>(
        <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}</button>))}
    </div>
    {tab==='home'&&<HomeTab fr={fr} onSim={onSim} simming={simming} recap={recap} grade={grade} events={events} onResolve={onResolve} pressConf={pressConf} onPressConf={onPressConf} newspaper={newspaper} cbaEvent={cbaEvent} onCBA={onCBA} namingOffer={namingOffer} onNaming={onNaming}/>}
    {tab==='roster'&&<RosterTab fr={fr} cap={cap}/>}
    {tab==='draft'&&<DraftTab fr={fr} setFr={setFr}/>}
    {tab==='coach'&&<CoachTab fr={fr} setFr={setFr}/>}
    {tab==='biz'&&<BizTab fr={fr} setFr={setFr}/>}
    {tab==='facilities'&&<FacTab fr={fr} setFr={setFr}/>}
    {tab==='legacy'&&<LegacyTab fr={fr}/>}
    {tab==='history'&&<HistTab fr={fr}/>}
  </div>);
}

/* ======== HOME TAB ======== */
function HomeTab({fr,onSim,simming,recap,grade,events,onResolve,pressConf,onPressConf,newspaper,cbaEvent,onCBA,namingOffer,onNaming}){
  const unres=events.filter(e=>!e.resolved);
  return(<div className="fade-in" style={{display:'flex',flexDirection:'column',gap:12}}>
    {recap&&<div className="card" style={{padding:16}}><h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Season Recap</h3>
      <p className="font-body" style={{lineHeight:1.6,color:'var(--ink-soft)',fontSize:'0.85rem'}}>{recap}</p>
      {grade&&<div style={{marginTop:10,display:'flex',alignItems:'center',gap:10}}>
        <span className="font-display" style={{fontSize:'1.8rem',fontWeight:700,color:grade.grade.startsWith('A')?'var(--green)':grade.grade.startsWith('B')?'var(--amber)':'var(--red)'}}>{grade.grade}</span>
        <span className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-muted)'}}>{grade.analysis}</span></div>}
    </div>}
    {/* Newspaper */}
    {newspaper&&<div className="card" style={{padding:16,border:'2px solid var(--ink)'}}>
      <div style={{textAlign:'center',borderBottom:'3px solid var(--ink)',paddingBottom:6,marginBottom:10}}>
        <div className="font-display" style={{fontSize:'0.6rem',letterSpacing:'0.2em',color:'var(--ink-muted)'}}>THE DAILY BALL · SEASON {newspaper.season}</div>
        <div className="font-display" style={{fontSize:'clamp(1rem,4vw,1.4rem)',fontWeight:700,lineHeight:1.1,marginTop:4}}>{newspaper.headline}</div>
      </div>
      {newspaper.stories.map((s,i)=><p key={i} className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-soft)',lineHeight:1.5,marginBottom:8}}>{s}</p>)}
      {newspaper.gmOfYear&&<div className="font-mono" style={{fontSize:'0.7rem',color:'var(--gold)',marginTop:6}}>🏆 GM of the Year: {newspaper.gmOfYear}</div>}
    </div>}
    {/* Press Conference */}
    {pressConf&&pressConf.length>0&&<div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>📰 Press Conference</h3>
      {pressConf.map(pc=>(
        <div key={pc.id} style={{marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--cream-darker)'}}>
          <p className="font-body" style={{fontSize:'0.85rem',fontStyle:'italic',color:'var(--ink-soft)',marginBottom:10}}>{pc.prompt}</p>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {pc.options.map((opt,oi)=>(
              <button key={oi} className="btn-secondary" style={{fontSize:'0.68rem',padding:'5px 12px'}} onClick={()=>onPressConf(pc.id,oi)}>{opt.label}</button>
            ))}
          </div>
        </div>
      ))}
    </div>}
    {/* CBA Event */}
    {cbaEvent&&<div className="card" style={{padding:16,borderLeft:'4px solid var(--amber)'}}>
      <h3 className="font-display" style={{fontSize:'0.9rem',fontWeight:700,color:'var(--amber)',marginBottom:6}}>⚖ {cbaEvent.title}</h3>
      <p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-soft)',marginBottom:10,lineHeight:1.5}}>{cbaEvent.description}</p>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {cbaEvent.choices.map((ch,ci)=>(
          <button key={ci} className="btn-secondary" style={{fontSize:'0.68rem',padding:'5px 12px'}} onClick={()=>onCBA(ci)}>
            {ch.label}<br/><span style={{fontSize:'0.6rem',color:'var(--ink-muted)'}}>{ch.desc}</span>
          </button>
        ))}
      </div>
    </div>}
    {/* Naming Rights */}
    {namingOffer&&<div className="card" style={{padding:16}}>
      <h3 className="font-display" style={{fontSize:'0.9rem',fontWeight:600,marginBottom:6}}>🏟 Naming Rights Offer</h3>
      <p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-soft)',marginBottom:10}}>{namingOffer.company} wants to name your stadium. ${namingOffer.annualPay}M/year for {namingOffer.years} years.</p>
      <div style={{display:'flex',gap:6}}>
        <button className="btn-primary" style={{fontSize:'0.7rem',padding:'5px 12px'}} onClick={()=>onNaming(true)}>Accept</button>
        <button className="btn-secondary" style={{fontSize:'0.7rem',padding:'5px 12px'}} onClick={()=>onNaming(false)}>Decline</button>
      </div>
    </div>}
    {/* Offseason Events */}
    {unres.length>0&&<div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Offseason ({unres.length})</h3>
      {unres.map(ev=>(<div key={ev.id} style={{marginBottom:14,paddingBottom:14,borderBottom:'1px solid var(--cream-darker)'}}>
        <h4 className="font-display" style={{fontSize:'0.85rem',fontWeight:600,marginBottom:3}}>{ev.title}</h4>
        <p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-soft)',marginBottom:10,lineHeight:1.5}}>{ev.description}</p>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {ev.choices.map((ch,ci)=>(<button key={ci} className="btn-secondary" style={{fontSize:'0.68rem',padding:'5px 12px'}} onClick={()=>onResolve(ev.id,ci)}>{ch.label}{ch.cost?` (-$${ch.cost}M)`:''}{ch.revenue?` (+$${ch.revenue}M)`:''}</button>))}
        </div>
      </div>))}
    </div>}
    {/* Stats */}
    <div className="stat-grid">
      {[['Fan',fr.fanRating,fr.fanRating>65?'var(--green)':null],['Chem',fr.lockerRoomChemistry,fr.lockerRoomChemistry>60?'var(--green)':'var(--amber)'],['Media',fr.mediaRep],['Community',fr.communityRating],['Revenue',`$${fr.finances.revenue}M`,'var(--green)'],['Profit',`$${fr.finances.profit}M`,fr.finances.profit>0?'var(--green)':'var(--red)']].map(([l,v,c])=>(
        <div key={l} className="card" style={{padding:'10px 12px',textAlign:'center'}}><div className="stat-label">{l}</div><div className="stat-value" style={{fontSize:'1rem',color:c||'var(--ink)'}}>{v}</div></div>))}
    </div>
    {fr.economyCycle&&fr.economyCycle!=='stable'&&<div className={`card ${fr.economyCycle==='boom'?'badge-green':'badge-red'}`} style={{padding:'8px 14px',textAlign:'center',fontSize:'0.75rem'}}>
      {fr.economyCycle==='boom'?'📈 City Economy: BOOM — Revenue boosted':'📉 City Economy: RECESSION — Revenue reduced'}
    </div>}
    <div style={{textAlign:'center',marginTop:6}}>
      <button className="btn-gold" onClick={onSim} disabled={simming||unres.length>0||(pressConf&&pressConf.length>0)||cbaEvent} style={{padding:'12px 36px',fontSize:'0.95rem'}}>
        {simming?'Simulating...':unres.length>0||pressConf?.length>0||cbaEvent?'Resolve All Events':'Simulate Season'}
      </button>
    </div>
  </div>);
}

/* ======== ROSTER TAB ======== */
function RosterTab({fr,cap}){
  const sorted=useMemo(()=>[...fr.players].sort((a,b)=>b.rating-a.rating),[fr.players]);
  return(<div className="fade-in">
    <div className="card" style={{padding:'10px 14px',marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span className="stat-label">Cap</span><span className="font-mono" style={{fontSize:'0.75rem'}}>${cap.used}M/${cap.cap}M <span style={{color:cap.space>10?'var(--green)':'var(--red)'}}>(${cap.space}M)</span></span></div>
      <div className="progress-bar" style={{marginTop:5}}><div className="progress-bar-fill" style={{width:`${Math.min(100,cap.used/cap.cap*100)}%`,background:cap.space>10?'var(--green)':cap.space>0?'var(--amber)':'var(--red)'}}/></div>
    </div>
    <div className="card table-wrap"><table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.72rem'}}>
      <thead><tr style={{borderBottom:'2px solid var(--cream-darker)'}}>{['Player','Pos','Age','Rtg','$M','Yrs','Trait',''].map(h=><th key={h} className="stat-label" style={{padding:'6px 8px',textAlign:'left'}}>{h}</th>)}</tr></thead>
      <tbody>{sorted.map(p=>(<tr key={p.id} style={{borderBottom:'1px solid var(--cream-dark)',background:p.injured?'#fef5f5':'transparent'}}>
        <td className="font-body" style={{padding:'6px 8px',fontWeight:500,whiteSpace:'nowrap'}}>{p.name}{p.isLocalLegend&&<span style={{color:'var(--gold)',marginLeft:3}}>★</span>}</td>
        <td className="font-mono" style={{padding:'6px 8px'}}>{p.position}</td><td className="font-mono" style={{padding:'6px 8px'}}>{p.age}</td>
        <td className="font-mono" style={{padding:'6px 8px',fontWeight:600,color:p.rating>=85?'var(--green)':p.rating>=70?'var(--ink)':'var(--ink-muted)'}}>{p.rating}</td>
        <td className="font-mono" style={{padding:'6px 8px'}}>{p.salary}</td>
        <td className="font-mono" style={{padding:'6px 8px',color:p.yearsLeft<=1?'var(--red)':'var(--ink)'}}>{p.yearsLeft}</td>
        <td>{p.trait&&<span className={`badge ${p.trait==='leader'?'badge-green':['mercenary'].includes(p.trait)?'badge-amber':['volatile','injury_prone'].includes(p.trait)?'badge-red':'badge-ink'}`}>{p.trait}</span>}</td>
        <td>{p.injured?<span className="badge badge-red">{p.injurySeverity}</span>:<span style={{color:'var(--green)',fontSize:'0.6rem'}}>OK</span>}</td>
      </tr>))}</tbody></table></div>
  </div>);
}

/* ======== DRAFT ======== */
function DraftTab({fr,setFr}){
  const[prospects,setP]=useState(null);
  const gen=()=>setP(generateDraftProspects(fr.league,30,fr.scoutingStaff));
  const draft=(p)=>{const pl=draftPlayer(p,fr.league);setFr(prev=>({...prev,players:[...prev.players,pl],totalSalary:Math.round((prev.totalSalary+pl.salary)*10)/10,rosterQuality:Math.round([...prev.players,pl].reduce((s,x)=>s+x.rating,0)/(prev.players.length+1))}));setP(prev=>prev.filter(x=>x.id!==p.id));};
  return(<div className="fade-in" style={{display:'flex',flexDirection:'column',gap:12}}>
    <div className="card" style={{padding:16,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <div><h3 className="font-display" style={{fontSize:'0.9rem',fontWeight:600}}>Draft Board</h3><p className="font-body" style={{fontSize:'0.7rem',color:'var(--ink-muted)'}}>Scout lvl {fr.scoutingStaff}/3</p></div>
      <button className="btn-primary" onClick={gen}>{prospects?'Reshuffle':'Scout Class'}</button>
    </div>
    {prospects&&<div className="card table-wrap"><table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.72rem'}}>
      <thead><tr style={{borderBottom:'2px solid var(--cream-darker)'}}>{['#','Name','Pos','Proj','Up','Trait',''].map(h=><th key={h} className="stat-label" style={{padding:'6px 8px',textAlign:'left'}}>{h}</th>)}</tr></thead>
      <tbody>{prospects.slice(0,15).map((p,i)=>(<tr key={p.id} style={{borderBottom:'1px solid var(--cream-dark)'}}>
        <td className="font-mono" style={{padding:'6px 8px',fontWeight:600}}>{i+1}</td><td className="font-body" style={{padding:'6px 8px',fontWeight:500}}>{p.name}</td>
        <td className="font-mono" style={{padding:'6px 8px'}}>{p.position}</td>
        <td className="font-mono" style={{padding:'6px 8px',fontWeight:600,color:p.projectedRating>=75?'var(--green)':'var(--ink)'}}>{p.projectedRating}</td>
        <td><span className={`badge ${p.upside==='high'?'badge-green':p.upside==='mid'?'badge-amber':'badge-ink'}`}>{p.upside}</span></td>
        <td>{p.trait&&<span className="badge badge-ink">{p.trait}</span>}</td>
        <td><button className="btn-secondary" style={{fontSize:'0.6rem',padding:'3px 8px'}} onClick={()=>draft(p)}>Draft</button></td>
      </tr>))}</tbody></table></div>}
  </div>);
}

/* ======== COACHING ======== */
function CoachTab({fr,setFr}){
  const[cands,setCands]=useState(null);const[cf,setCf]=useState(false);const c=fr.coach;
  return(<div className="fade-in" style={{display:'flex',flexDirection:'column',gap:12}}>
    <div className="card-elevated" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Head Coach</h3>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10}}>
        <div><div className="font-display" style={{fontSize:'1.1rem',fontWeight:700}}>{c.name}</div>
          <div className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-soft)',marginTop:3}}>{c.personality} · Lvl {c.level}/4 · {c.seasonsWithTeam}yr</div>
          <div style={{display:'flex',gap:3,marginTop:6}}>{[1,2,3,4].map(l=><div key={l} style={{width:20,height:6,borderRadius:2,background:c.level>=l?'var(--red)':'var(--cream-darker)'}}/>)}</div></div>
        {!cf?<button className="btn-secondary" style={{borderColor:'var(--red)',color:'var(--red)',fontSize:'0.7rem'}} onClick={()=>setCf(true)}>Fire</button>
        :<div style={{display:'flex',gap:6}}>
          <button className="btn-primary" style={{fontSize:'0.7rem',padding:'5px 10px'}} onClick={()=>{setFr(()=>fireCoach(fr));setCands(generateCoachCandidates(3));setCf(false);}}>Confirm (-${c.level*2}M)</button>
          <button className="btn-secondary" style={{fontSize:'0.7rem',padding:'5px 10px'}} onClick={()=>setCf(false)}>Cancel</button></div>}
      </div>
    </div>
    {cands&&<div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Candidates</h3>
      {cands.map(cd=>(<div key={cd.name} className="card" style={{padding:'12px 14px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <div><div className="font-display" style={{fontSize:'0.85rem',fontWeight:600}}>{cd.name}</div>
          <div className="font-body" style={{fontSize:'0.75rem',color:'var(--ink-soft)'}}>{cd.personality} · Lvl {cd.level}</div>
          <div className="font-body" style={{fontSize:'0.7rem',color:'var(--ink-muted)',fontStyle:'italic',marginTop:3}}>{cd.backstory}</div></div>
        <button className="btn-primary" style={{fontSize:'0.65rem',padding:'5px 12px'}} onClick={()=>{setFr(()=>hireCoach(fr,cd));setCands(null);}}>Hire</button>
      </div>))}
    </div>}
  </div>);
}

/* ======== BUSINESS ======== */
function BizTab({fr,setFr}){
  const proj=useMemo(()=>projectRevenue(fr),[fr]);
  return(<div className="fade-in" style={{display:'flex',flexDirection:'column',gap:12}}>
    <div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Revenue</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <div><div className="stat-label">Revenue</div><div className="stat-value" style={{color:'var(--green)'}}>${proj.totalRevenue}M</div></div>
        <div><div className="stat-label">Expenses</div><div className="stat-value" style={{color:'var(--red)'}}>${proj.totalExpenses}M</div></div>
        <div><div className="stat-label">Profit</div><div className="stat-value" style={{color:proj.projectedProfit>0?'var(--green)':'var(--red)'}}>${proj.projectedProfit}M</div></div>
      </div>
    </div>
    <div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Tickets</h3>
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <span className="stat-label">Price</span>
        <input type="range" min="30" max="200" step="5" value={fr.ticketPrice} onChange={e=>setFr(p=>({...p,ticketPrice:Number(e.target.value)}))} style={{flex:1,minWidth:120}}/>
        <span className="stat-value">${fr.ticketPrice}</span>
      </div>
      <div style={{display:'flex',gap:16,marginTop:10}}>
        <div><span className="stat-label">Attendance</span><div className="stat-value" style={{color:proj.attendance>75?'var(--green)':proj.attendance>55?'var(--amber)':'var(--red)'}}>{proj.attendance}%</div></div>
        <div><span className="stat-label">Gate Rev</span><div className="stat-value">${proj.gateRevenue}M</div></div>
      </div>
    </div>
    {/* Debt */}
    <div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Debt & Loans</h3>
      <div style={{display:'flex',gap:16,marginBottom:10}}>
        <div><span className="stat-label">Current Debt</span><div className="stat-value" style={{color:(fr.debt||0)>0?'var(--red)':'var(--ink)'}}>${fr.debt||0}M</div></div>
        <div><span className="stat-label">Max Loan</span><div className="stat-value">${maxLoan(fr)}M</div></div>
        <div><span className="stat-label">Interest</span><div className="stat-value">8%/yr</div></div>
      </div>
      <div style={{display:'flex',gap:6}}>
        <button className="btn-secondary" style={{fontSize:'0.7rem'}} disabled={(fr.debt||0)>=maxLoan(fr)} onClick={()=>setFr(p=>takeLoan(p,10))}>Borrow $10M</button>
        <button className="btn-secondary" style={{fontSize:'0.7rem'}} disabled={!(fr.debt>0&&fr.cash>=10)} onClick={()=>setFr(p=>repayDebt(p,10))}>Repay $10M</button>
      </div>
    </div>
    {/* Naming Rights */}
    {fr.namingRightsActive&&<div className="card" style={{padding:'10px 14px'}}>
      <span className="stat-label">🏟 Stadium: </span><span className="font-body" style={{fontSize:'0.8rem'}}>{fr.namingRightsName} Arena — ${fr.namingRightsDeal}M/yr ({fr.namingRightsYears}yr left)</span>
    </div>}
  </div>);
}

/* ======== FACILITIES ======== */
function FacTab({fr,setFr}){
  const upgrade=(field)=>{const cur=fr[field];if(cur>=3)return;const cost=UPGRADE_COSTS[cur]||15;if((fr.cash||0)<cost)return;setFr(p=>({...p,[field]:cur+1,cash:Math.round(((p.cash||0)-cost)*10)/10}));};
  const facs=[['scoutingStaff','Scouting','Draft eval'],['developmentStaff','Player Dev','Growth'],['medicalStaff','Medical','Injuries'],['marketingStaff','Marketing','Fans'],['trainingFacility','Training','Win%'],['weightRoom','Weight Room','Conditioning'],['filmRoom','Film Room','Tactics']];
  return(<div className="fade-in" style={{display:'flex',flexDirection:'column',gap:8}}>
    <div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Stadium</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        <div><div className="stat-label">Capacity</div><div className="stat-value">{fr.stadiumCapacity.toLocaleString()}</div></div>
        <div><div className="stat-label">Condition</div><div className="stat-value" style={{color:fr.stadiumCondition>70?'var(--green)':fr.stadiumCondition>40?'var(--amber)':'var(--red)'}}>{fr.stadiumCondition}%</div></div>
        <div><div className="stat-label">Age</div><div className="stat-value">{fr.stadiumAge}yr</div></div>
      </div>
    </div>
    <div className="card" style={{padding:'8px 14px'}}><span className="stat-label">Cash: </span><span className="stat-value" style={{color:(fr.cash||0)>5?'var(--green)':'var(--red)'}}>${Math.round((fr.cash||0)*10)/10}M</span></div>
    {facs.map(([key,label,desc])=>{const cur=fr[key];const cost=UPGRADE_COSTS[cur];const ok=(fr.cash||0)>=(cost||999);
      return(<div key={key} className="card" style={{padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div className="font-display" style={{fontSize:'0.8rem',fontWeight:600}}>{label}</div><div style={{fontSize:'0.65rem',color:'var(--ink-muted)'}}>{desc}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',gap:2}}>{[1,2,3].map(l=><div key={l} style={{width:18,height:6,borderRadius:2,background:cur>=l?'var(--red)':'var(--cream-darker)'}}/>)}</div>
          {cur<3&&<button className="btn-secondary" style={{fontSize:'0.6rem',padding:'3px 8px',opacity:ok?1:0.4}} disabled={!ok} onClick={()=>upgrade(key)}>${cost}M</button>}
        </div>
      </div>);})}
  </div>);
}

/* ======== LEGACY TAB — Trophy Room, Legends, Timeline ======== */
function LegacyTab({fr}){
  const trophies=fr.trophies||[];const legends=fr.localLegends||[];const dynasty=fr.dynastyEra;
  return(<div className="fade-in" style={{display:'flex',flexDirection:'column',gap:12}}>
    {/* Trophies */}
    <div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>🏆 Championship Banners</h3>
      {trophies.length===0?<p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-muted)'}}>No championships yet. Keep building.</p>
      :<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {trophies.map((t,i)=>(<div key={i} style={{background:'var(--gold)',color:'var(--ink)',padding:'10px 16px',borderRadius:2,textAlign:'center',minWidth:80}}>
          <div className="font-display" style={{fontSize:'1rem',fontWeight:700}}>S{t.season}</div>
          <div className="font-mono" style={{fontSize:'0.65rem'}}>{t.wins}-{t.losses}</div>
        </div>))}
      </div>}
    </div>
    {/* Local Legends */}
    <div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>★ Local Legends</h3>
      {legends.length===0?<p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-muted)'}}>Players who serve 5+ seasons with a 70+ peak rating become legends.</p>
      :legends.map((l,i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--cream-dark)'}}>
        <span className="font-body" style={{fontSize:'0.85rem',fontWeight:500}}>{l.name}</span>
        <span className="font-mono" style={{fontSize:'0.75rem',color:'var(--ink-muted)'}}>Peak {l.rating} · {l.seasons}yr</span>
      </div>))}
    </div>
    {/* Timeline */}
    {fr.history.length>0&&<div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>📅 Timeline</h3>
      <div style={{display:'flex',gap:4,overflowX:'auto',paddingBottom:8}}>
        {fr.history.map(h=>{const wp=h.wins/(h.wins+h.losses);const isChamp=trophies.some(t=>t.season===h.season);
          return(<div key={h.season} style={{minWidth:50,textAlign:'center',padding:'6px 4px',borderRadius:2,background:isChamp?'var(--gold)':wp>0.6?'var(--green)':wp<0.35?'var(--red)':'var(--cream-dark)',color:isChamp||wp>0.6||wp<0.35?'#fff':'var(--ink)'}}>
            <div className="font-mono" style={{fontSize:'0.6rem',fontWeight:600}}>S{h.season}</div>
            <div className="font-mono" style={{fontSize:'0.55rem'}}>{h.wins}-{h.losses}</div>
          </div>);})}
      </div>
    </div>}
    {/* Value Chart */}
    {fr.history.length>1&&<div className="card" style={{padding:16}}>
      <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>📈 Cash History</h3>
      <MiniChart data={fr.history.map(h=>h.cash||0)} color="var(--green)"/>
    </div>}
  </div>);
}

/* ======== HISTORY ======== */
function HistTab({fr}){
  return(<div className="fade-in"><div className="card" style={{padding:16}}>
    <h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Season History</h3>
    {fr.history.length===0?<p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-muted)'}}>No seasons yet.</p>:
    <div className="table-wrap"><table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.72rem'}}>
      <thead><tr style={{borderBottom:'2px solid var(--cream-darker)'}}>{['S','Rec','Rev','Profit','Cash','Fan','Econ'].map(h=><th key={h} className="stat-label" style={{padding:'6px 8px',textAlign:'left'}}>{h}</th>)}</tr></thead>
      <tbody>{[...fr.history].reverse().map(h=>(<tr key={h.season} style={{borderBottom:'1px solid var(--cream-dark)'}}>
        <td className="font-mono" style={{padding:'6px 8px',fontWeight:600}}>{h.season}</td>
        <td className="font-mono" style={{padding:'6px 8px'}}>{h.wins}-{h.losses}</td>
        <td className="font-mono" style={{padding:'6px 8px',color:'var(--green)'}}>${h.revenue}M</td>
        <td className="font-mono" style={{padding:'6px 8px',color:h.profit>0?'var(--green)':'var(--red)'}}>${h.profit}M</td>
        <td className="font-mono" style={{padding:'6px 8px'}}>${Math.round((h.cash||0)*10)/10}M</td>
        <td className="font-mono" style={{padding:'6px 8px'}}>{h.fanRating}</td>
        <td className="font-mono" style={{padding:'6px 8px'}}>{h.economy==='boom'?'📈':h.economy==='recession'?'📉':'—'}</td>
      </tr>))}</tbody></table></div>}
  </div></div>);
}

/* ======== LEAGUE ======== */
function LeagueScreen({lt,fr}){
  const[vl,setVl]=useState('ngl');const standings=useMemo(()=>[...(lt?.[vl]||[])].sort((a,b)=>b.wins-a.wins),[lt,vl]);const pids=fr.map(f=>f.id);
  return(<div style={{maxWidth:850,margin:'0 auto',padding:'16px 12px'}}>
    <div style={{display:'flex',gap:6,marginBottom:12}}>
      <button className={vl==='ngl'?'btn-primary':'btn-secondary'} onClick={()=>setVl('ngl')}>🏈 NGL</button>
      <button className={vl==='abl'?'btn-primary':'btn-secondary'} onClick={()=>setVl('abl')}>🏀 ABL</button>
    </div>
    <div className="card table-wrap"><table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.72rem'}}>
      <thead><tr style={{borderBottom:'2px solid var(--cream-darker)'}}>{['#','Team','Tier','W','L','%','Fan','Mkt'].map(h=><th key={h} className="stat-label" style={{padding:'6px 8px',textAlign:'left'}}>{h}</th>)}</tr></thead>
      <tbody>{standings.map((t,i)=>{const isP=pids.includes(t.id);const ti=getMarketTierInfo(t.market);
        return(<tr key={t.id} style={{borderBottom:'1px solid var(--cream-dark)',background:isP?'#fef5f5':'transparent',fontWeight:isP?600:400}}>
          <td className="font-mono" style={{padding:'6px 8px'}}>{i+1}</td>
          <td className="font-body" style={{padding:'6px 8px',whiteSpace:'nowrap'}}>{t.city} {t.name}{isP&&<span style={{color:'var(--red)',marginLeft:4,fontSize:'0.6rem'}}>YOU</span>}</td>
          <td><span className="font-mono" style={{fontSize:'0.6rem',color:ti.color}}>T{getMarketTier(t.market)}</span></td>
          <td className="font-mono" style={{padding:'6px 8px'}}>{t.wins}</td><td className="font-mono" style={{padding:'6px 8px'}}>{t.losses}</td>
          <td className="font-mono" style={{padding:'6px 8px'}}>{t.wins+t.losses>0?((t.wins/(t.wins+t.losses))*100).toFixed(0):'—'}</td>
          <td className="font-mono" style={{padding:'6px 8px'}}>{t.fanRating}</td><td className="font-mono" style={{padding:'6px 8px'}}>{t.market}</td>
        </tr>);})}</tbody></table></div>
  </div>);
}

/* ======== MARKET ======== */
function MarketScreen({lt,cash,stakes,season,setStakes,setCash}){
  const[offers,setOffers]=useState([]);
  useEffect(()=>{if(lt)setOffers(generateStakeOffers(lt,cash,season));},[lt,season]);
  const buy=(o)=>{if(cash<o.price)return;setCash(c=>Math.round((c-o.price)*10)/10);setStakes(p=>[...p,{teamId:o.teamId,teamName:o.teamName,league:o.league,stakePct:o.stakePct,purchasePrice:o.price}]);setOffers(p=>p.filter(x=>x.id!==o.id));};
  const income=calcStakeIncome(stakes,lt||{ngl:[],abl:[]});
  return(<div style={{maxWidth:750,margin:'0 auto',padding:'16px 12px'}}>
    <h2 className="font-display section-header" style={{fontSize:'1.2rem'}}>Investment Market</h2>
    {stakes.length>0&&<div className="card" style={{padding:16,marginBottom:12}}>
      <h3 className="font-display" style={{fontSize:'0.85rem',fontWeight:600,marginBottom:8}}>Your Stakes</h3>
      <div className="stat-label">Income/Season: <span className="stat-value" style={{color:income>0?'var(--green)':'var(--red)'}}>${income}M</span></div>
      {stakes.map((s,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--cream-dark)'}}><span className="font-body" style={{fontSize:'0.8rem'}}>{s.teamName}</span><span className="font-mono" style={{fontSize:'0.75rem'}}>{s.stakePct}%</span></div>)}
    </div>}
    <div className="card" style={{padding:16}}>
      <h3 className="font-display" style={{fontSize:'0.85rem',fontWeight:600,marginBottom:8}}>Offers</h3>
      {offers.length===0?<p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-muted)'}}>{season<3?'Unlocks S3.':cash<15?'Need $15M+.':'None this season.'}</p>
      :offers.map(o=>(<div key={o.id} className="card" style={{padding:'12px 14px',marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <div><div className="font-display" style={{fontSize:'0.85rem',fontWeight:600}}>{o.teamName}</div><div className="font-mono" style={{fontSize:'0.65rem',color:'var(--ink-muted)'}}>{o.league.toUpperCase()} · {o.record} · T{getMarketTier(o.market)} · {o.stakePct}%</div></div>
        <button className="btn-primary" style={{fontSize:'0.65rem',padding:'5px 12px'}} disabled={cash<o.price} onClick={()=>buy(o)}>Buy ${o.price}M</button>
      </div>))}
    </div>
  </div>);
}

/* ======== SETTINGS ======== */
function Settings({onDelete,setScreen}){
  const[key,setKey]=useState('');const[saved,setSaved]=useState(false);
  const saveKey=()=>{if(key.trim()){setNarrativeApiKey(key.trim());try{localStorage.setItem('bob_api',key.trim())}catch{}setSaved(true);setTimeout(()=>setSaved(false),2000);}};
  return(<div style={{maxWidth:550,margin:'0 auto',padding:'30px 16px'}}>
    <h2 className="font-display section-header" style={{fontSize:'1.2rem'}}>Settings</h2>
    <div className="card" style={{padding:16,marginBottom:12}}>
      <h3 className="font-display" style={{fontSize:'0.85rem',fontWeight:600,marginBottom:6}}>Claude API (Optional)</h3>
      <p className="font-body" style={{fontSize:'0.75rem',color:'var(--ink-muted)',marginBottom:10}}>AI narratives. Works without it.</p>
      <div style={{display:'flex',gap:6}}><input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="sk-ant-..." className="font-mono" style={{flex:1,padding:'6px 10px',border:'1px solid var(--cream-darker)',borderRadius:2,fontSize:'0.75rem',background:'var(--cream)'}}/><button className="btn-secondary" onClick={saveKey}>{saved?'✓':'Save'}</button></div>
      <div className="font-mono" style={{fontSize:'0.65rem',color:hasNarrativeApi()?'var(--green)':'var(--ink-muted)',marginTop:6}}>{hasNarrativeApi()?'● AI Active':'○ Procedural'}</div>
    </div>
    <div className="card" style={{padding:16,borderColor:'var(--red)'}}><button className="btn-secondary" style={{borderColor:'var(--red)',color:'var(--red)',fontSize:'0.75rem'}} onClick={()=>{if(confirm('Delete save?')){onDelete();setScreen('intro');}}}>Delete Save</button></div>
  </div>);
}

/* ================================================================ */
/* MAIN APP                                                         */
/* ================================================================ */
export default function App(){
  const[screen,setScreen]=useState('intro');const[loading,setLoading]=useState(true);
  const[cash,setCash]=useState(0);const[gmRep,setGmRep]=useState(50);const[dynasty,setDynasty]=useState([]);
  const[lt,setLt]=useState(null);const[fr,setFr]=useState([]);const[stakes,setStakes]=useState([]);
  const[season,setSeason]=useState(1);const[freeAg,setFreeAg]=useState({ngl:[],abl:[]});
  const[activeIdx]=useState(0);const[simming,setSimming]=useState(false);
  const[recap,setRecap]=useState(null);const[grade,setGrade]=useState(null);const[events,setEvents]=useState([]);
  const[pressConf,setPressConf]=useState(null);const[newspaper,setNewspaper]=useState(null);
  const[cbaEvent,setCbaEvent]=useState(null);const[namingOffer,setNamingOffer]=useState(null);
  const[saveStatus,setSaveStatus]=useState('saved');

  useEffect(()=>{try{const k=localStorage.getItem('bob_api');if(k)setNarrativeApiKey(k);}catch{}},[]);
  useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);
  useEffect(()=>{(async()=>{const s=await loadGame();if(s){setCash(s.cash??0);setGmRep(s.gmReputation||50);setDynasty(s.dynastyHistory||[]);setLt(s.leagueTeams);setFr(s.franchises||[]);setStakes(s.stakes||[]);setSeason(s.season||1);setFreeAg(s.freeAgents||{ngl:[],abl:[]});}setLoading(false);})();},[]);

  const doSave=useCallback(async()=>{if(!lt||fr.length===0)return;setSaveStatus('saving');await saveGame({cash,gmReputation:gmRep,dynastyHistory:dynasty,leagueTeams:lt,franchises:fr,stakes,season,freeAgents:freeAg});setSaveStatus('saved');},[cash,gmRep,dynasty,lt,fr,stakes,season,freeAg]);
  const saveTimer=useRef(null);
  useEffect(()=>{if(!lt||fr.length===0)return;if(saveTimer.current)clearTimeout(saveTimer.current);saveTimer.current=setTimeout(doSave,2000);return()=>clearTimeout(saveTimer.current);},[fr,lt,cash,season,doSave]);

  const handleNew=()=>{const league=initializeLeague();setLt(league);setCash(0);setGmRep(50);setDynasty([]);setFr([]);setStakes([]);setSeason(1);setFreeAg({ngl:generateFreeAgents('ngl'),abl:generateFreeAgents('abl')});setRecap(null);setGrade(null);setEvents([]);setPressConf(null);setNewspaper(null);setCbaEvent(null);setNamingOffer(null);setScreen('setup');};
  const handleLoad=()=>{if(fr.length>0&&lt)setScreen('dashboard');};
  const handleCreate=(tmpl,league)=>{const nf=createPlayerFranchise(tmpl,league);setCash(nf.cash||0);setLt(p=>({...p,[league]:p[league].map(t=>t.id===tmpl.id?{...t,isPlayerOwned:true}:t)}));setFr(p=>[...p,nf]);generateOffseasonEvents(nf).then(evts=>setEvents(evts.map(e=>({...e,resolved:false}))));setScreen('dashboard');};

  const handleResolve=(eid,ci)=>{setEvents(p=>p.map(e=>{if(e.id!==eid)return e;const ch=e.choices[ci];
    setFr(pf=>pf.map((f,i)=>{if(i!==activeIdx)return f;const u={...f};
      if(ch.cost){u.cash=Math.round(((u.cash||0)-ch.cost)*10)/10;setCash(u.cash);}
      if(ch.revenue){u.cash=Math.round(((u.cash||0)+ch.revenue)*10)/10;setCash(u.cash);}
      if(ch.communityBonus)u.communityRating=clamp((u.communityRating||50)+ch.communityBonus,0,100);
      if(ch.mediaBonus)u.mediaRep=clamp((u.mediaRep||50)+ch.mediaBonus,0,100);
      if(ch.stadiumBonus)u.stadiumCondition=clamp(u.stadiumCondition+ch.stadiumBonus,0,100);
      if(ch.coachBonus&&u.coach.level<4)u.coach={...u.coach,level:u.coach.level+1};
      return u;}));return{...e,resolved:true};}));};

  const handlePressConf=(pcId,optIdx)=>{setPressConf(p=>{const pc=p.find(x=>x.id===pcId);if(!pc)return p.filter(x=>x.id!==pcId);const opt=pc.options[optIdx];
    setFr(pf=>pf.map((f,i)=>{if(i!==activeIdx)return f;const u={...f};
      if(opt.fanBonus)u.fanRating=clamp(u.fanRating+opt.fanBonus,0,100);
      if(opt.mediaBonus)u.mediaRep=clamp((u.mediaRep||50)+opt.mediaBonus,0,100);
      if(opt.communityBonus)u.communityRating=clamp((u.communityRating||50)+opt.communityBonus,0,100);
      if(opt.moraleBonus)u.players=u.players.map(pl=>({...pl,morale:clamp(pl.morale+opt.moraleBonus,0,100)}));
      return u;}));return p.filter(x=>x.id!==pcId);});};

  const handleCBA=(ci)=>{const ch=cbaEvent.choices[ci];
    if(ch.strikeRisk&&Math.random()<ch.strikeRisk){setRecap(p=>(p||'')+' A STRIKE shortened the season by 20 games, devastating revenue.');}
    setFr(pf=>pf.map((f,i)=>{if(i!==activeIdx)return f;const u={...f};
      if(ch.moraleBonus)u.players=u.players.map(pl=>({...pl,morale:clamp(pl.morale+ch.moraleBonus,0,100)}));
      if(ch.revenuePenalty)u.cash=Math.round((u.cash+(ch.revenuePenalty||0))*10)/10;
      return u;}));setCbaEvent(null);};

  const handleNaming=(accept)=>{if(accept&&namingOffer)setFr(pf=>pf.map((f,i)=>i===activeIdx?acceptNamingRights(f,namingOffer):f));setNamingOffer(null);};

  const handleSim=async()=>{if(simming)return;setSimming(true);setRecap(null);setGrade(null);setNewspaper(null);
    await new Promise(r=>setTimeout(r,300));
    const res=simulateFullSeason(lt,fr,season);setLt(res.leagueTeams);setFr(res.franchises);setSeason(s=>s+1);
    const stakeInc=calcStakeIncome(stakes,res.leagueTeams);const newCash=(res.franchises[activeIdx]?.cash||0)+stakeInc;setCash(Math.round(newCash*10)/10);
    // GM Rep update
    const af=res.franchises[activeIdx];if(af){const wp=af.wins/(af.wins+af.losses||1);let repDelta=0;if(wp>0.6)repDelta+=rand(2,5);else if(wp<0.35)repDelta-=rand(1,4);if(af.finances.profit>0)repDelta+=1;setGmRep(r=>clamp(r+repDelta,0,100));}
    // Narratives
    if(res.franchises.length>0){const f=res.franchises[activeIdx];
      const[rc,gr]=await Promise.all([generateSeasonRecap(f),generateGMGrade(f)]);setRecap(rc);setGrade(gr);
      if(season%3===0){const d=await generateDynastyNarrative(f);setDynasty(p=>[...p,{...d,season}]);setFr(pf=>pf.map((x,i)=>i===activeIdx?{...x,dynastyEra:d.era}:x));}
      // Newspaper
      const standings=f.league==='ngl'?res.standings.ngl:res.standings.abl;setNewspaper(generateNewspaper(standings,res.franchises,season,res.leagueTeams));
      // Press Conference
      setPressConf(genPressConference(f));
      // CBA check
      const cba=generateCBAEvent(season);setCbaEvent(cba);
      // Naming rights offer (if none active)
      if(!f.namingRightsActive&&Math.random()<0.3){setNamingOffer(generateNamingRightsOffer(f));}else{setNamingOffer(null);}
      // Offseason events
      const ne=await generateOffseasonEvents(f);setEvents(ne.map(e=>({...e,resolved:false})));
    }
    setFreeAg({ngl:generateFreeAgents('ngl'),abl:generateFreeAgents('abl')});setSimming(false);await doSave();};

  const handleDelete=async()=>{await deleteSave();setLt(null);setFr([]);setCash(0);setGmRep(50);setSeason(1);setRecap(null);setGrade(null);setEvents([]);setPressConf(null);setNewspaper(null);setCbaEvent(null);};

  const setActiveFr=(upd)=>setFr(p=>p.map((f,i)=>i===activeIdx?(typeof upd==='function'?upd(f):upd):f));

  if(loading)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:14}}>
    <div className="spinner" style={{width:28,height:28}}/><span className="font-display" style={{color:'var(--ink-muted)',letterSpacing:'0.1em',textTransform:'uppercase',fontSize:'0.75rem'}}>Loading...</span></div>);

  const af=fr[activeIdx];
  return(<div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
    <Ticker lt={lt} fr={fr} season={season}/>
    <Nav screen={screen} setScreen={setScreen} fr={fr} gmRep={gmRep} cash={af?.cash??cash}/>
    <main style={{flex:1,paddingBottom:30}}>
      {screen==='intro'&&<Intro onNew={handleNew} onLoad={handleLoad} hasSv={fr.length>0}/>}
      {screen==='setup'&&<Setup onCreate={handleCreate}/>}
      {screen==='dashboard'&&af&&<Dashboard fr={af} setFr={setActiveFr} onSim={handleSim} simming={simming} recap={recap} grade={grade} events={events} onResolve={handleResolve} pressConf={pressConf} onPressConf={handlePressConf} newspaper={newspaper} cbaEvent={cbaEvent} onCBA={handleCBA} namingOffer={namingOffer} onNaming={handleNaming}/>}
      {screen==='league'&&<LeagueScreen lt={lt} fr={fr}/>}
      {screen==='market'&&<MarketScreen lt={lt} cash={af?.cash??cash} stakes={stakes} season={season} setStakes={setStakes} setCash={c=>{setCash(typeof c==='function'?c(cash):c);setFr(p=>p.map((f,i)=>i===activeIdx?{...f,cash:typeof c==='function'?c(f.cash||0):c}:f));}}/>}
      {screen==='portfolio'&&af&&<div style={{maxWidth:700,margin:'0 auto',padding:'20px 12px'}}>
        <h2 className="font-display section-header" style={{fontSize:'1.2rem'}}>Empire Overview</h2>
        <div className="card" style={{padding:'10px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:'1.2rem'}}>{getGMTier(gmRep).badge}</span>
          <span className="font-display" style={{fontSize:'0.85rem'}}>{getGMTier(gmRep).label}</span>
          <span className="font-mono" style={{fontSize:'0.7rem',color:'var(--ink-muted)'}}>Rep: {gmRep}/100</span>
        </div>
        <div className="stat-grid" style={{marginBottom:16}}>
          {[['Net Worth',`$${calculateValuation(af)+stakes.length*15}M`],['Cash',`$${Math.round((af.cash||0)*10)/10}M`,(af.cash||0)>0?'var(--green)':'var(--red)'],['Debt',`$${af.debt||0}M`,(af.debt||0)>0?'var(--red)':'var(--ink)'],['Franchises',fr.length],['Stakes',stakes.length],['Season',season],['Titles',af.championships||0,'var(--gold)'],['Legends',(af.localLegends||[]).length]].map(([l,v,c])=>(
            <div key={l} className="card" style={{padding:'10px 12px',textAlign:'center'}}><div className="stat-label">{l}</div><div className="stat-value" style={{fontSize:'1rem',color:c||'var(--ink)'}}>{v}</div></div>))}
        </div>
        {dynasty.length>0&&<div className="card" style={{padding:16}}><h3 className="font-display section-header" style={{fontSize:'0.9rem'}}>Dynasty Eras</h3>
          {dynasty.map((d,i)=><div key={i} style={{marginBottom:10}}><div className="font-display" style={{fontSize:'0.85rem',color:'var(--gold)',fontWeight:600}}>{d.era} <span className="font-mono" style={{fontSize:'0.65rem',color:'var(--ink-muted)'}}>S{d.season}</span></div>
            <p className="font-body" style={{fontSize:'0.8rem',color:'var(--ink-soft)',lineHeight:1.5}}>{d.narrative}</p></div>)}</div>}
      </div>}
      {screen==='settings'&&<Settings onDelete={handleDelete} setScreen={setScreen}/>}
    </main>
    <div style={{position:'fixed',bottom:8,right:8,padding:'3px 8px',borderRadius:2,background:saveStatus==='saving'?'var(--amber)':'var(--green)',color:'#fff',fontSize:'0.6rem',fontFamily:'var(--font-mono)',opacity:0.7}}>{saveStatus==='saving'?'Saving...':'Saved'}</div>
  </div>);
}
