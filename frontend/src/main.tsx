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
      setResult(data);setBalance(data.balance);tg?.HapticFeedback?.notificationOccurred('success');
    }catch(e:any){setError(e.message||'Не удалось подключиться к серверу')}
    finally{setBusy(false)}
  }

  const nav:{id:Tab;symbol:string;label:string}[]=[
    {id:'spin',symbol:'◉',label:'Крутка'},
    {id:'collection',symbol:'▤',label:'Коллекция'},
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

    {tab==='collection'&&<section className="page-view"><div className="page-title"><span className="eyebrow">ТВОИ НАХОДКИ</span><h1>Коллекция</h1><p>Все номера, которые ты открыл.</p></div>{inventory.length?<div className="inventory-list">{inventory.map(item=><div className="inventory-item" key={item.item_id}><div className="inventory-plate">{item.code}</div><div><b>{item.rarity}</b><small>{item.region} · {item.category}</small></div><span>›</span></div>)}</div>:<div className="empty-state"><div className="empty-icon">▤</div><b>Здесь пока пусто</b><p>Твои новые номера будут появляться здесь после прокрутки.</p><button onClick={()=>setTab('spin')}>ОТКРЫТЬ ПЕРВЫЙ НОМЕР</button></div>}</section>}
    {tab==='rating'&&<section className="page-view"><div className="page-title"><span className="eyebrow">NUMBER RUSH COMMUNITY</span><h1>Рейтинг</h1><p>Сравнивай свою коллекцию с другими игроками.</p></div><div className="empty-state"><div className="empty-icon">♧</div><b>Рейтинг скоро появится</b><p>Готовим таблицу лучших коллекционеров.</p></div></section>}
    {tab==='profile'&&<section className="page-view"><div className="page-title"><span className="eyebrow">ТВОЙ АККАУНТ</span><h1>Профиль</h1><p>Информация о твоём игровом аккаунте.</p></div><div className="profile-card"><div className="profile-avatar">{(user?.first_name||'N').slice(0,1).toUpperCase()}</div><b>{user?.first_name||'Коллекционер'}</b><small>@{user?.username||'number_rush_player'}</small><div className="profile-divider"/><div className="profile-line"><span>Баланс</span><b>{balance.toLocaleString('ru-RU')} ₽</b></div><div className="profile-line"><span>Статус</span><b className="profile-status">Участник клуба</b></div></div></section>}

    <nav className="bottom-nav">{nav.map(item=><button key={item.id} className={tab===item.id?'nav-item selected':'nav-item'} onClick={()=>setTab(item.id)}><span>{item.symbol}</span><small>{item.label}</small></button>)}</nav>
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
