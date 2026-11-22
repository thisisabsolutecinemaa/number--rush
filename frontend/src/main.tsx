import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

declare global { interface Window { Telegram?: any } }
const tg = window.Telegram?.WebApp;
const API_URL = import.meta.env.VITE_API_URL || 'https://number-rush-api-1ywd.onrender.com';
tg?.ready();
tg?.expand();

type Tab = 'spin' | 'collection' | 'rating' | 'profile';
const regions = {
  UA:{flag:'🇺🇦',sample:'AA 0000 XX',name:'Украина',detail:'UA · ЕВРОПЕЙСКИЙ ФОРМАТ'},
  CN:{flag:'🇨🇳',sample:'京 A·88888',name:'Китай',detail:'CN · КИТАЙСКИЙ ФОРМАТ'},
  RU:{flag:'🇷🇺',sample:'А 000 АА 77',name:'Россия',detail:'RU · РОССИЙСКИЙ ФОРМАТ'},
  EU:{flag:'🇪🇺',sample:'AB · 123 · CD',name:'Европа',detail:'EU · ЕВРОПЕЙСКИЙ ФОРМАТ'}
};

function App() {
  const [balance,setBalance]=React.useState(100000);
  const [result,setResult]=React.useState<any>(null);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [tab,setTab]=React.useState<Tab>('spin');
  const [country,setCountry]=React.useState<keyof typeof regions>('UA');
  const [inventory,setInventory]=React.useState<any[]>([]);
  const [showChoice,setShowChoice]=React.useState(false);
  const [notice,setNotice]=React.useState('');
  const initData=tg?.initData || '';
  const user=tg?.initDataUnsafe?.user;

  React.useEffect(()=>{
    if(!initData) return;
    fetch(`${API_URL}/api/me`,{headers:{'X-Telegram-Init-Data':initData},cache:'no-store'})
      .then(r=>r.ok?r.json():null).then(d=>{if(d?.balance!==undefined)setBalance(d.balance)}).catch(()=>{});
  },[initData]);

  React.useEffect(()=>{
    if(tab!=='collection'||!initData)return;
    fetch(`${API_URL}/api/inventory`,{headers:{'X-Telegram-Init-Data':initData},cache:'no-store'})
      .then(r=>r.ok?r.json():[]).then(d=>setInventory(Array.isArray(d)?d:[])).catch(()=>setInventory([]));
  },[tab,initData]);

  async function spin(){
    if(busy)return;
    if(!initData){setError('Открой NUMBER RUSH из Telegram, чтобы играть и сохранять номера.');return;}
    setBusy(true);setError('');setResult(null);
    try{
      const response=await fetch(`${API_URL}/api/spin`,{method:'POST',headers:{'X-Telegram-Init-Data':initData},cache:'no-store'});
      const raw=await response.text();
      let data:any;
      try{data=JSON.parse(raw)}catch{throw new Error('Сервер прислал неправильный ответ. Попробуй ещё раз.')}
      if(!response.ok)throw new Error(data.detail||'Не удалось открыть номер');
      setResult(data);setBalance(data.balance);setShowChoice(true);tg?.HapticFeedback?.notificationOccurred('success');
    }catch(e:any){setError(e.message||'Не удалось подключиться к серверу')}
    finally{setBusy(false)}
  }

  async function refreshGarage(){
    const response=await fetch(API_URL+"/api/inventory",{headers:{"X-Telegram-Init-Data":initData},cache:"no-store"});
    if(response.ok){const data=await response.json();setInventory(Array.isArray(data)?data:[]);}
  }

  async function sellItem(itemId:number){
    const response=await fetch(API_URL+"/api/sell",{method:"POST",headers:{"Content-Type":"application/json","X-Telegram-Init-Data":initData},body:JSON.stringify({item_id:itemId})});
    const data=await response.json();
    if(!response.ok){setNotice(data.detail||"Не удалось продать номер");return;}
    setBalance(data.balance);setNotice("Продано за "+data.amount.toLocaleString("ru-RU")+" ₽");await refreshGarage();
  }

  async function sellAll(){
    if(!window.confirm("Продать все номера в гараже, кроме экипированных талисманов?"))return;
    const response=await fetch(API_URL+"/api/sell-all",{method:"POST",headers:{"X-Telegram-Init-Data":initData},cache:"no-store"});
    const data=await response.json();
    if(!response.ok){setNotice(data.detail||"Не удалось продать номера");return;}
    setBalance(data.balance);setNotice("Продано номеров: "+data.sold+". Получено "+data.amount.toLocaleString("ru-RU")+" ₽");await refreshGarage();
  }

  const nav:{id:Tab;symbol:string;label:string}[]=[
    {id:'spin',symbol:'◉',label:'Крутка'},
    {id:'collection',symbol:'▤',label:'Гараж'},
    {id:'rating',symbol:'♧',label:'Рейтинг'},
    {id:'profile',symbol:'●',label:'Профиль'}
  ];

  return <main className="app-shell">
    <header className="topbar">
      <div className="app-icon">NR</div>
      <div className="brand-copy"><b>Number Rush</b><small>Plate collection</small></div>
      <div className="online-pill"><i/> Онлайн</div>
    </header>

    <section className="wallet-card">
      <div className="wallet-top"><span>МОЙ БАЛАНС</span><span className="wallet-mark">₽</span></div>
      <div className="wallet-amount">{balance.toLocaleString('ru-RU')} <small>₽</small></div>
      <div className="wallet-bottom"><span>Игровые рубли</span><span>NUMBER RUSH WALLET</span></div>
    </section>

    {tab==='spin'&&<section className="spin-view">
      <div className="welcome"><span className="eyebrow">КОЛЛЕКЦИОНИРУЙ НОМЕРА СО ВСЕГО МИРА</span><h1>Найди свой<br/><span>особенный номер.</span></h1><p>Редкие комбинации, красивые номера и настоящие коллекционные экземпляры.</p></div>
      <div className="section-row"><b>Регион</b><span>Выбери страну</span></div>
      <div className="region-picker">
        {(Object.keys(regions) as (keyof typeof regions)[]).map(code=><button key={code} className={country===code?'region-option active':'region-option'} onClick={()=>setCountry(code)}><span>{regions[code].flag}</span><b>{code}</b></button>)}
      </div>
      <div className="plate-card">
        <div className="plate-card-head"><span>ПРИМЕР НОМЕРА</span><span>ОБРАЗЕЦ</span></div>
        <div className={`plate plate-${country.toLowerCase()}`}><div className="plate-country"><span>{regions[country].flag}</span><small>{country}</small></div><strong>{regions[country].sample}</strong><i className="plate-bolt left"/><i className="plate-bolt right"/></div>
        <div className="plate-caption"><b>{regions[country].name}</b><span>{regions[country].detail}</span></div>
      </div>
      <div className="chance-card"><div><span className="chance-icon">✦</span><div><b>Редкие находки</b><small>Чем выше редкость, тем ценнее номер</small></div></div><span className="chance-arrow">›</span></div>
      <button className="spin-button" onClick={spin} disabled={busy}><span>{busy?'ОТКРЫВАЕМ…':'ПРОКРУТИТЬ'}</span><b>{busy?'…':'5 000 ₽'}</b></button>
      <div className="spin-caption">10 ПРОКРУТОК — 50 000 ₽ <span>•</span> СЛУЧАЙНЫЙ РЕЗУЛЬТАТ</div>
      {error&&<div className="notice error">{error}</div>}
      {result&&<div className="result-card"><div className="result-check">✓</div><div><small>НОВЫЙ НОМЕР В КОЛЛЕКЦИИ</small><h2>{result.code}</h2><b>{result.rarity} · {result.region}</b></div></div>}
    </section>}

    {tab==='collection'&&<section className="page-view"><div className="page-title"><span className="eyebrow">ТВОИ НАХОДКИ</span><h1>Гараж</h1><p>Храни, продавай и собирай коллекцию номеров.</p></div>{inventory.length>0&&<button className="sell-all-button" onClick={sellAll}>ПРОДАТЬ ВСЁ НЕЭКИПИРОВАННОЕ</button>}{notice&&<div className="notice">{notice}</div>}{inventory.length?<div className="inventory-list">{inventory.map(item=><div className="inventory-item" key={item.item_id}><div className="inventory-plate">{item.code}</div><div className="inventory-info"><b>{item.rarity}</b><small>{item.region} · {item.category}</small><small>{item.equipped?"Экипирован":"Цена продажи: "+({ "Обычный":500,"Необычный":1500,"Редкий":5000,"Эпический":15000,"Легендарный":50000,"Мифический":150000,"Секретный":500000,"Абсолют":1000000 }[item.rarity]||500).toLocaleString("ru-RU")+" ₽"}</small></div>{!item.equipped&&<button className="sell-item-button" onClick={()=>sellItem(item.item_id)}>Слить</button>}</div>)}</div>:<div className="empty-state"><div className="empty-icon">▤</div><b>Здесь пока пусто</b><p>Твои новые номера будут появляться здесь после прокрутки.</p><button onClick={()=>setTab('spin')}>ОТКРЫТЬ ПЕРВЫЙ НОМЕР</button></div>}</section>}
    {tab==='rating'&&<section className="page-view"><div className="page-title"><span className="eyebrow">NUMBER RUSH COMMUNITY</span><h1>Рейтинг</h1><p>Сравнивай свою коллекцию с другими игроками.</p></div><div className="empty-state"><div className="empty-icon">♧</div><b>Рейтинг скоро появится</b><p>Готовим таблицу лучших коллекционеров.</p></div></section>}
    {tab==='profile'&&<section className="page-view"><div className="page-title"><span className="eyebrow">ТВОЙ АККАУНТ</span><h1>Профиль</h1><p>Информация о твоём игровом аккаунте.</p></div><div className="profile-card"><div className="profile-avatar">{(user?.first_name||'N').slice(0,1).toUpperCase()}</div><b>{user?.first_name||'Коллекционер'}</b><small>@{user?.username||'number_rush_player'}</small><div className="profile-divider"/><div className="profile-line"><span>Баланс</span><b>{balance.toLocaleString('ru-RU')} ₽</b></div><div className="profile-line"><span>Статус</span><b className="profile-status">Участник клуба</b></div></div></section>}

      {showChoice&&result&&<div className="choice-overlay"><div className="choice-sheet"><div className="choice-handle"/><span className="eyebrow">НОМЕР ПОЛУЧЕН</span><h2>{result.code}</h2><p>{result.rarity} · {result.region}</p><button className="choice-sell" onClick={()=>{sellItem(result.item_id);setShowChoice(false)}}>СЛИТЬ ЗА {Number(result.sell_value||0).toLocaleString("ru-RU")} ₽</button><button className="choice-garage" onClick={()=>{setShowChoice(false);setTab("collection");refreshGarage()}}>В ГАРАЖ</button></div></div>}
    <nav className="bottom-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'nav-item selected':'nav-item'} onClick={()=>setTab(item.id)}><span>{item.symbol}</span><small>{item.label}</small></button>)}</nav>
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
