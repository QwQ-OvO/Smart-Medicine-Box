import {writeFileSync} from 'node:fs';
const C={teal:'#177d80',blue:'#346fa8',orange:'#a86b24',ink:'#203539',muted:'#637679'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
let a=[],H;
function rect(x,y,w,h,fill='#fff',stroke='#bdcece',r=12){a.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`)}
function txt(x,y,lines,size=18,color=C.ink,weight=400){a.push(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${[].concat(lines).map((s,i)=>`<tspan x="${x}" dy="${i?size*1.5:0}">${esc(s)}</tspan>`).join('')}</text>`)}
function box(x,y,w,h,title,lines=[],k='teal'){rect(x,y,w,h,k==='orange'?'#fff5e7':k==='blue'?'#eff5fc':'#fff',C[k]);txt(x+18,y+31,title,20,C[k],600);if(lines.length)txt(x+18,y+61,lines,17)}
function arrow(p,label='',x=0,y=0,k='teal'){a.push(`<polyline points="${p.map(v=>v.join(',')).join(' ')}" fill="none" stroke="${C[k]}" stroke-width="2" stroke-linejoin="round" marker-end="url(#${k})"/>`);if(label)txt(x,y,label,15,C[k])}
function start(n,title,sub,h){H=h;a=[`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="${h}" viewBox="0 0 1440 ${h}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(sub)}。依据 2026-10-10 当前代码，详细对照见当前产品图解文档。</desc><defs>${['teal','blue','orange'].map(k=>`<marker id="${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${C[k]}"/></marker>`).join('')}</defs><g font-family="Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif">`];rect(0,0,1440,h,'#fafcfc','none',0);txt(48,43,`家庭药箱 / 当前产品设计    ${n}`,16,C.teal,600);txt(48,89,title,32,C.ink,700);txt(48,124,sub,18,C.muted)}
function end(file,note){a.push(`<path d="M48 ${H-66} H1392" stroke="#bdcece"/>`);txt(48,H-35,note,16,C.muted);txt(1184,H-35,'代码快照 · 2026-10-10',15,C.muted);a.push('</g></svg>');writeFileSync(new URL(file,import.meta.url),a.join('\n')+'\n')}

start('01','产品架构设计概览','围绕一盒药的位置线索组织功能：先记录，后查找，再通过反馈修正。',1000);
function panel(x,y,n,t,sub,items){rect(x,y,660,292,'#edf7f6','#c8dedd');txt(x+24,y+36,`${n}  ${t}`,23,C.teal,600);txt(x+24,y+68,sub,17,C.muted);items.forEach((p,i)=>box(x+24+i%2*312,y+92+Math.floor(i/2)*88,300,74,p[0],[p[1]]))}
panel(48,160,'A','记录与核对','/record · 新包装录入／已有包装补充位置',[
['一句话整理','手工填写随时可用'],['核对草稿','药名、包装标签、具体位置'],['位置照片','每条位置可附一张照片'],['确认并保存','保存成功后进入位置线索']]);
panel(732,160,'B','查找与定位','/ → /search → /clue/:id',[
['按药名搜索','匹配本机已保存包装'],['区分同名包装','一条直达，多条手动选择'],['最近记录位置','展示时间、来源和照片'],['无记录提示','暂无记录不代表家里没有']]);
panel(48,476,'C','反馈与历史','/clue/:id · /history/:id',[
['在这里找到了','只确认本次查找结果'],['这里没找到','保存反馈，不推断用完'],['补充新位置','新增观察，保留旧位置'],['历史线索','位置、反馈及历史照片']]);
panel(732,476,'D','支撑能力','浏览器本地数据 + 后端文字解析',[
['本地数据','Dexie / IndexedDB'],['保存一致性','事务、命令去重、版本检查'],['解析服务','显式 Mock 或配置 Live'],['草稿边界','用户确认后才写入本机']]);
box(48,802,1344,108,'产品边界',['无需登录；记录和照片保存在当前浏览器。没有跨设备同步、实时库存、智能硬件联动或用药推荐。'],'orange');
end('01-product-overview.svg','阅读顺序：模块概览 → 系统与数据流 → 查找决策 → 记录泳道');

start('02','系统协作与数据流','文字解析跨网络；包装、位置观察、反馈和照片保存在浏览器内。',1120);
rect(48,164,708,748,'#edf7f6');txt(72,200,'浏览器 · React + 本机数据',24,C.teal,600);
rect(788,164,604,748,'#f2f6fa');txt(812,200,'后端 · Fastify 文字解析',24,C.blue,600);
box(76,232,648,120,'页面与交互 · App.tsx',['Home / Search / Record / CluePage / History','Record 中组织输入、解析、核对与保存']);
box(76,446,648,100,'MedicineStore + 领域规则',['execute / search / clue / history / photo；deriveClue 推导状态']);
arrow([[400,352],[400,446]],'确认后的命令 / 本地查询',414,399);
txt(72,385,'发送描述，返回候选草稿。',16,C.blue);txt(72,411,'照片与本地记录不随解析发送。',16,C.blue);
box(76,606,648,258,'Dexie → IndexedDB · medicine-location-v1',[
'packages：包装身份、规范化药名与标签、revision',
'observations：位置、来源、确认时间、可选 photoId',
'feedback：关联 observationId 的找到／未找到结果',
'photos：JPEG Blob、添加时间、拍摄时间（当前为空）',
'commands：命令指纹和回执，用于重复命令去重',
'同事务完成写入；失败回滚，保留旧位置与旧照片']);
arrow([[400,546],[400,606]],'读写本机记录',414,583);
box(820,232,540,120,'HTTP 接口',['GET /api/v1/health · GET /api/v1/capabilities','POST /api/v1/parse-previews']);
arrow([[724,265],[820,265]],'',0,0,'blue');arrow([[820,327],[724,327]],'',0,0,'blue');
box(820,414,540,110,'parseText 解析服务',['请求校验、限流、超时控制','校验供应商结果结构与一致性']);arrow([[1090,352],[1090,414]],'仅处理文字',1104,391,'blue');
box(820,590,255,128,'Mock 演示模式',['固定规则提取','明确标示演示解析'],'blue');box(1105,590,255,128,'Live 适配模式',['配置 HTTPS 模型接口','密钥仅在服务端'],'blue');
arrow([[1090,524],[1090,552],[946,552],[946,590]],'',0,0,'blue');arrow([[1090,552],[1232,552],[1232,590]],'',0,0,'blue');
txt(820,764,['输出：ready / needs-confirmation / out-of-scope','候选药名与位置只是草稿，不能直接形成已存记录。','后端没有药品数据库，也没有照片上传接口。'],18,C.muted);
box(48,942,1344,88,'事实来源：用户确认后的本机记录',['模型不判断真实位置；本机数据按 origin 隔离，清除网站数据会删除记录和照片。'],'orange');
end('02-system-data-flow.svg','实线表示调用或数据流；两个 provider 为模式选择，不是同时执行。');

start('03','查找场景与处理决策','与 Search、CluePage 和 deriveClue 的当前行为对应；不把历史位置当作实时保证。',1160);
box(48,166,310,96,'输入药名并查找',['空白输入时首页按钮禁用']);arrow([[358,214],[410,214]]);
box(410,166,982,96,'搜索本机包装',['规范化药名后进行包含匹配；当前页面最多读取 100 条结果']);
arrow([[710,262],[710,288],[388,288],[388,634]]);
['0 条结果','1 条结果','多条结果'].forEach((s,i)=>{let y=310+i*140;box(410,y,260,88,s,[['无匹配记录','自动进入详情','展示包装供选择'][i]],i===0?'orange':'teal');arrow([[388,y+44],[410,y+44]])});
box(770,310,622,88,'暂无位置线索',['可进入“记一个位置”；不判断家里是否有药'],'orange');arrow([[670,354],[770,354]],'显示空态',682,341,'orange');
box(770,450,622,88,'位置线索 · /clue/:id',['最近位置 + 记录时间 + 来源 + 可选照片']);arrow([[670,494],[770,494]],'直达',695,481);
box(770,590,622,88,'选择药名 + 包装标签',['点击某一盒后，进入这盒药的位置线索']);arrow([[670,634],[770,634]],'手动选择',682,621);arrow([[1370,590],[1370,552],[1100,552],[1100,538]]);
txt(48,736,'线索页面的当前状态与可用动作',23,C.teal,600);
box(48,768,432,204,'recorded · 最近记录位置',['在这里找到了 → found-at-time','这里没找到 → not-found','两种反馈均关联当前观察','可查看这盒药的历史']);
box(504,768,432,204,'found-at-time · 本次找到',['回到首页','这里没找到 → not-found','位置变了 → 核对并新增位置','可查看这盒药的历史']);
box(960,768,432,204,'not-found · 本次未找到',['在别处找到了 → 补充新位置','或暂时结束查找 → 首页','旧位置与反馈仍保留在历史中','可查看这盒药的历史'],'orange');
rect(48,998,1344,76,'#edf7f6');txt(72,1028,'状态规则：选择 seq 最大的位置观察，再选择仅属于该观察的最新反馈。',18,C.teal,600);txt(72,1055,'新增位置后回到 recorded，旧观察的反馈不会影响新位置；empty 是无观察时的领域状态。',17,C.muted);
end('03-search-decisions.svg','找到只代表本次结果；未找到不代表用完；所有状态均不推断库存数量。');

start('04','记录位置与核对保存泳道','从用户输入到本机提交；AI 解析为可选分支，已有包装从手工更新位置开始。',1440);
[['用户','输入与事实确认'],['前端页面','Record / PhotoInput'],['解析后端（可选）','Fastify / parseText'],['本机仓储','MedicineStore / IndexedDB']].forEach((l,i)=>{let x=48+i*336;rect(x,162,324,1130,i%2?'#f1f6f6':'#f5f8f8','#d8e2e2',0);txt(x+20,198,l[0],23,C.teal,600);txt(x+20,228,l[1],16,C.muted)});
box(64,270,292,108,'① 记一个位置',['一句话描述或手工填写','已有包装：补充新位置']);box(400,270,292,108,'② 保留可编辑草稿',['药名／标签／位置／照片','照片可选，仅在本机处理']);arrow([[356,324],[400,324]]);
box(736,438,292,108,'③ 解析文字',['ready：候选字段齐全','needs-confirmation：需补全'],'blue');arrow([[546,378],[546,418],[882,418],[882,438]],'仅“一句话整理”调用',650,406,'blue');
box(400,610,292,108,'④ 展示待核对记录',['可编辑；已有包装身份固定','ready 仍须用户确认']);arrow([[882,546],[882,580],[546,580],[546,610]],'返回候选草稿',660,568,'blue');arrow([[410,378],[410,610]],'手工填写',418,565);
box(64,610,292,108,'⑤ 核对并确认保存',['缺药名或位置：补全','同名多盒：用不同标签']);arrow([[400,653],[356,653]]);arrow([[356,695],[400,695]]);
box(736,610,292,162,'解析失败或超出范围',['显示错误并保留原文','可重试或改为手工填写','不自动保存解析结果'],'orange');arrow([[1020,546],[1020,610]],'',0,0,'orange');
box(400,832,292,108,'⑥ 提交保存命令',['create-record 或','record-location']);arrow([[546,718],[546,832]]);
box(1072,832,292,156,'⑦ 校验与原子提交',['字段／同名包装／版本检查','命令去重；同事务写入','包装、观察、照片及回执']);arrow([[692,876],[1072,876]],'确认后的内容（含可选照片）',756,863);
box(400,1060,292,108,'⑧ 保存成功',['进入 /clue/:id','展示新位置线索']);arrow([[1218,988],[1218,1022],[546,1022],[546,1060]],'返回保存回执',792,1011);
box(736,1136,628,108,'保存失败：保留当前表单并提示错误',['可重试；空间不足可移除照片后保存；','版本冲突需返回查看最新线索。'],'orange');arrow([[1336,988],[1336,1136]],'',0,0,'orange');
rect(48,1320,1344,44,'#fff5e7');txt(68,1349,'照片先在浏览器解码、缩放并转成 JPEG；不进入文字解析请求。新位置不会自动沿用旧照片。',18,C.orange);
end('04-recording-swimlane.svg','时间自上而下；蓝色为可选解析，琥珀色为异常分支，绿色为记录主流程。');
console.log('Generated four SVG diagrams.');
