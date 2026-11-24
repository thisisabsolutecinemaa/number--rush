import React from 'react';

type Operator = {id:number;name:string;country:string;country_code:string;custom:boolean;price:number};
type Props = {apiUrl:string;initData:string;isAdmin:boolean;onBalance:(n:number)=>void};

export default function SimHub({apiUrl,initData,isAdmin,onBalance}:Props){
  const [operators,setOperators]=React.useState<Operator[]>([]);
  const [selected,setSelected]=React.useState('');
  const [country,setCountry]=React.useState('Все страны');
  const [rolling,setRolling]=React.useState(false);
  const [result,setResult]=React.useState<any>(null);
  const [notice,setNotice]=React.useState('');
  const [name,setName]=React.useState('');
  const [newCountry,setNewCountry]=React.useState('NUMBER RUSH');
  const [code,setCode]=React.useState('NR');
  const [prefixes,setPrefixes]=React.useState('+999');
  const [price,setPrice]=React.useState('1000000000');
  const headers={'X-Telegram-Init-Data':initData,'Content-Type':'application/json'};
  async function load(){const r=await fetch(apiUrl+'/api/operators',{cache:'no-store'});const d=await r.json();if(r.ok){setOperators(d.operators||[]);if(!selected&&d.operators?.length)setSelected(String(d.operators[0].id));}}
  React.useEffect(()=>{load().catch(()=>setNotice('Не удалось загрузить операторов'));},[]);
  const countries=Array.from(new Set(operators.map(o=>o.country)));
  const shown=operators.filter(o=>country==='Все страны'||o.country===country);
  async function generate(){
    if(!selected||rolling)return;
    setRolling(true);setResult(null);setNotice('');
    try{
      const r=await fetch(apiUrl+'/api/sim/generate',{method:'POST',headers,body:JSON.stringify({operator_id:Number(selected)})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.detail||'Операция отклонена сервером');
      window.setTimeout(()=>{setResult(d);onBalance(d.balance);setNotice('SIM-карта сохранена в гараже');setRolling(false);},1250);
    }catch(e:any){setNotice(e.message||'Ошибка генерации');setRolling(false);}
  }
  async function createOperator(){
    try{
      const r=await fetch(apiUrl+'/api/admin/operators',{method:'POST',headers,body:JSON.stringify({name,country:newCountry,country_code:code,prefixes:prefixes.split(',').map(x=>x.trim()),price:Number(price)})});
      const d=await r.json();if(!r.ok)throw new Error(d.detail||'Не удалось создать оператора');
      setNotice('Новый оператор добавлен');setName('');await load();
    }catch(e:any){setNotice(e.message||'Ошибка');}
  }
  async function toggleOperator(id:number){
    const r=await fetch(apiUrl+'/api/admin/operators/'+id+'/toggle',{method:'POST',headers});
    const d=await r.json();if(!r.ok){setNotice(d.detail||'Не удалось изменить статус');return;}await load();
  }
  const current=operators.find(o=>String(o.id)===selected);
  return <section className="page-view sim-view">
    <div className="page-title"><span className="eyebrow">NUMBER RUSH · MOBILE COLLECTION</span><h1>SIM-карты</h1><p>Собирай номера мобильных операторов СНГ. Каждая карта сохраняется в гараже.</p></div>
    <div className="sim-filter"><label>Страна</label><select value={country} onChange={e=>setCountry(e.target.value)}><option>Все страны</option>{countries.map(c=><option key={c}>{c}</option>)}</select></div>
    <div className="sim-operator-grid">{shown.map(o=><button key={o.id} className={'sim-operator '+(selected===String(o.id)?'active':'')} onClick={()=>setSelected(String(o.id))}><span className="sim-operator-dot"/><b>{o.name}</b><small>{o.country}</small>{o.custom&&<em>Кастом · {(o.price/1000000000).toFixed(1)} млрд ₽</em>}</button>)}</div>
    <div className="sim-card-preview">
      <div className="sim-card-chip"><i/><i/><i/><i/></div><div className="sim-card-brand">NUMBER RUSH <span>SIM</span></div>
      <div className="sim-card-operator">{current?.name||'Выбери оператора'}</div><div className="sim-card-country">{current?.country||'СНГ'} · DIGITAL SIM</div>
      <div className="sim-card-bottom"><span>4G / 5G</span><span>NR COLLECTION</span></div>
    </div>
    <div className={'sim-number-window '+(rolling?'rolling':'')}>{rolling?<><span>+7 000 000 00 00</span><small>Подбираем комбинацию…</small></>:result?<><span>{result.number}</span><small>{result.operator} · {result.country}</small></>:<><span>+_ ___ ___ __ __</span><small>Новый номер появится здесь</small></>}</div>
    <button className="sim-generate" disabled={!selected||rolling} onClick={generate}>{rolling?'ГЕНЕРАЦИЯ…':'ВЫПУСТИТЬ SIM · '+(current?.custom?current.price:5000).toLocaleString('ru-RU')+' ₽'}</button>
    {notice&&<div className="notice">{notice}</div>}
    {isAdmin&&<div className="admin-section sim-admin"><b>Админ-панель · свои операторы</b><small>Кастомный оператор стоит минимум 1 000 000 000 игровых рублей за выпуск номера.</small>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название оператора"/>
      <input value={newCountry} onChange={e=>setNewCountry(e.target.value)} placeholder="Страна / бренд"/>
      <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().slice(0,3))} placeholder="Код страны"/>
      <input value={prefixes} onChange={e=>setPrefixes(e.target.value)} placeholder="Префиксы через запятую: +999,+998"/>
      <input value={price} onChange={e=>setPrice(e.target.value)} inputMode="numeric" placeholder="Цена от 1000000000"/>
      <button disabled={!name.trim()||Number(price)<1000000000} onClick={createOperator}>СОЗДАТЬ ОПЕРАТОРА</button>
      <div className="sim-admin-list">{operators.filter(o=>o.custom).map(o=><div key={o.id}><span><b>{o.name}</b><small>{o.country} · {o.price.toLocaleString('ru-RU')} ₽</small></span><button onClick={()=>toggleOperator(o.id)}>ВКЛ / ВЫКЛ</button></div>)}</div>
    </div>}
  </section>;
}
