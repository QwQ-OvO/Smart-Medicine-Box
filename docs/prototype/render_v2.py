"""Static Apple-HIG-inspired storyboard; SVG is editable, PNG is supersampled.
Hallmark: modern-minimal / task storyboard / bright restrained blue.
Pre-emit critique: P4 H5 E4 S4 R5 V4. Static artifact, no interactive claims.
"""
from pathlib import Path
from html import escape
import math, json
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
W,H,S=1380,1832,2
C={'canvas':'#F5F6F8','surface':'#FFFFFF','group':'#F2F2F7','ink':'#1C1C1E','muted':'#62626B','rule':'#DFE1E7','accent':'#0064D9','accent-ink':'#FFFFFF','tint':'#EAF2FF','amber':'#805B13','amber-soft':'#FFF5DE','green':'#237448','green-soft':'#EDF7F0'}
F={'body':'C:/Windows/Fonts/Deng.ttf','display':'C:/Windows/Fonts/Dengb.ttf'}
STACK='-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "DengXian", "Microsoft YaHei", sans-serif'

def rgb(h): return [int(h[i:i+2],16)/255 for i in (1,3,5)]
def linear(v): return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def oklch(h):
    r,g,b=map(linear,rgb(h));l=(.4122214708*r+.5363325363*g+.0514459929*b)**(1/3);m=(.2119034982*r+.6806995451*g+.1073969566*b)**(1/3);s=(.0883024619*r+.2817188376*g+.6299787005*b)**(1/3)
    L=.2104542553*l+.793617785*m-.0040720468*s;a=1.9779984951*l-2.428592205*m+.4505937099*s;b=.0259040371*l+.7827717662*m-.808675766*s
    return f'oklch({L:.5f} {math.hypot(a,b):.5f} {math.degrees(math.atan2(b,a))%360:.3f})'
tokens='/* Hallmark · macrostructure: task storyboard · genre: modern-minimal · tone: bright restrained · anchor: blue */\n/* pre-emit critique: P4 H5 E4 S4 R5 V4 */\n:root {\n'+''.join(f'  --color-{k}: {oklch(v)};\n' for k,v in C.items())+f'  --font-body: {STACK};\n  --font-display: var(--font-body);\n'+''.join(f'  --space-{k}: {v}px;\n' for k,v in [('xs',4),('sm',8),('md',16),('lg',24),('xl',32),('2xl',48)])+'  --text-title: 32px;\n  --text-body: 17px;\n  --text-caption: 14px;\n  --radius-group: 20px;\n  --radius-action: 26px;\n}\n'
(ROOT/'tokens.css').write_text(tokens,encoding='utf-8')
im=Image.new('RGB',(W*S,H*S),C['canvas']);d=ImageDraw.Draw(im)
svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc"><title id="title">家庭药箱位置线索 明亮版设计稿</title><desc id="desc">六个静态界面，演示数据。查找、录入、核对、历史线索、未找到与位置更新。</desc><style>{escape(tokens)}</style>',f'<rect width="{W}" height="{H}" fill="var(--color-canvas)"/>']
checks=[]; panels=[]
def box(x,y,w,h,fill='surface',r=20,stroke=None):
    d.rounded_rectangle(tuple(int(v*S) for v in (x,y,x+w,y+h)),radius=r*S,fill=C[fill],outline=C[stroke] if stroke else None,width=S)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="var(--color-{fill})"'+(f' stroke="var(--color-{stroke})"' if stroke else '')+'/>')
def txt(x,y,t,size=17,color='ink',bold=False,maxw=None):
    f=ImageFont.truetype(F['display' if bold else 'body'],size*S)
    if maxw: assert d.textlength(t,font=f)<=maxw*S, (t,maxw)
    d.text((x*S,y*S),t,font=f,fill=C[color])
    svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" style="font-family:var(--font-{"display" if bold else "body"});font-weight:{600 if bold else 400};font-size:{size}px;fill:var(--color-{color})">{escape(t)}</text>')
def line(x,y,x2,y2,color='rule',width=1):
    d.line((x*S,y*S,x2*S,y2*S),fill=C[color],width=width*S)
    svg.append(f'<path d="M{x} {y} L{x2} {y2}" stroke="var(--color-{color})" stroke-width="{width}" fill="none" stroke-linecap="round"/>')
def ellipse(x,y,w,h,color='accent',outline=False,width=2):
    bounds=(x*S,y*S,(x+w)*S,(y+h)*S)
    d.ellipse(bounds,fill=None if outline else C[color],outline=C[color] if outline else None,width=width*S)
    svg.append(f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" fill="{"none" if outline else "var(--color-"+color+")"}"'+(f' stroke="var(--color-{color})" stroke-width="{width}"' if outline else '')+'/>')
def icon(x,y,kind,color='accent'):
    if kind=='search': ellipse(x+1,y+1,15,15,color,True);line(x+14,y+15,x+21,y+22,color,2)
    elif kind=='plus':line(x+12,y+3,x+12,y+21,color,2);line(x+3,y+12,x+21,y+12,color,2)
    elif kind=='check':line(x+3,y+12,x+9,y+18,color,2);line(x+9,y+18,x+22,y+4,color,2)
    elif kind=='back':line(x+15,y+3,x+6,y+12,color,2);line(x+6,y+12,x+15,y+21,color,2)
    elif kind=='bag':
        box(x+2,y+7,24,22,'tint',5,'accent');line(x+8,y+7,x+8,y+1,color,2);line(x+8,y+1,x+20,y+1,color,2);line(x+20,y+1,x+20,y+7,color,2);line(x+8,y+20,x+20,y+20,color,2)
    elif kind=='clock':
        ellipse(x+1,y+1,22,22,color,True);line(x+12,y+6,x+12,y+12,color,2);line(x+12,y+12,x+17,y+15,color,2)
def button(x,y,label,secondary=False):
    box(x,y,342,52,'tint' if secondary else 'accent',26)
    f=ImageFont.truetype(F['display'],17*S);tw=d.textlength(label,font=f)/S
    txt(x+(342-tw)/2,y+16,label,17,'accent' if secondary else 'accent-ink',True,maxw=310)
def center(x,y,label,color='accent'):
    f=ImageFont.truetype(F['body'],16*S);tw=d.textlength(label,font=f)/S;txt(x+(342-tw)/2,y,label,16,color)
def panel(x,y,code,title,back=False):
    txt(x,y-56,code,14,'muted',True)
    txt(x,y-32,title,19,'ink',True)
    box(x,y,390,620,'group',24)
    panels.append((x,y))
    if back:icon(x+22,y+21,'back');txt(x+49,y+24,'返回',16,'accent')
    else:txt(x+24,y+24,'我的药箱',16,'muted',True);icon(x+341,y+20,'plus')
def head(x,y,title,sub):
    txt(x+24,y+76,title,32,bold=True,maxw=342);txt(x+24,y+122,sub,16,'muted',maxw=342)
def foot(x,y,t):center(x+24,y+584,t,'muted')

txt(56,40,'家庭药箱',18,'muted',True)
txt(56,77,'让位置线索，一眼清楚。',42,bold=True)
txt(56,138,'明亮的内容分组、克制的色彩、清晰的操作层级。',18,'muted')
txt(56,179,'v0.2  ·  静态设计稿  ·  全部为演示数据  ·  按钮不可操作',14,'muted')

x,y=56,296
panel(x,y,'S1','查找入口');head(x,y,'找药','知道药名，就从已有线索开始。')
box(x+24,y+172,342,56,'surface',16);icon(x+40,y+188,'search','muted');txt(x+77,y+190,'布洛芬',18)
button(x+24,y+248,'查找位置')
txt(x+24,y+340,'整理时，顺手记下来',20,bold=True)
txt(x+24,y+374,'给下一次查找，留一个起点。',16,'muted')
box(x+24,y+416,342,68,'surface',20);ellipse(x+40,y+432,36,36,'tint');icon(x+46,y+438,'plus');txt(x+92,y+441,'记一个位置',18,'accent',True);txt(x+333,y+438,'›',24,'muted')
foot(x,y,'位置记录不代表实时库存')

x=496
panel(x,y,'S2','记录描述',True);head(x,y,'记下放在哪里','一句话描述，稍后核对。')
box(x+24,y+172,342,208,'surface',20)
txt(x+44,y+197,'这盒布洛芬放在',22,maxw=302);txt(x+44,y+234,'黑色背包前袋。',22,maxw=302)
txt(x+44,y+337,'位置由你提供，AI 帮你整理。',14,'muted')
button(x+24,y+448,'整理这句话');center(x+24,y+528,'改为手工填写')
foot(x,y,'核对后才会保存')

x=936
panel(x,y,'S3','核对信息',True);head(x,y,'核对一下','确认名称和位置，就可以保存。')
box(x+24,y+172,342,264,'surface',20)
for off,label,val in [(192,'药品名称','布洛芬'),(280,'包装标签 · 区分同名药','随身盒'),(368,'位置','黑色背包 / 前袋')]:
    txt(x+44,y+off,label,14,'muted');txt(x+44,y+off+29,val,19,bold=off==368)
for off in [260,348]:line(x+44,y+off,x+346,y+off)
button(x+24,y+472,'确认并保存');foot(x,y,'AI 整理的内容可以修改')

txt(56,952,'留下线索  →  核对保存  →  下次查找',16,'muted')
line(56,992,1326,992)

y=1100;x=56
panel(x,y,'S4','最近位置',True);head(x,y,'布洛芬','随身盒')
box(x+24,y+164,342,282,'surface',20)
icon(x+44,y+187,'bag');txt(x+84,y+192,'最近记录的位置',14,'muted')
txt(x+44,y+238,'黑色背包',30,bold=True);txt(x+44,y+281,'前袋',23,bold=True)
line(x+44,y+326,x+346,y+326)
txt(x+44,y+347,'10 月 8 日 18:30 · 你确认的位置',14,'muted')
box(x+44,y+385,220,32,'tint',16);txt(x+57,y+393,'当前是否仍在，尚未确认',14,'accent')
button(x+24,y+474,'在这里找到了');center(x+24,y+550,'这里没找到')

x=496
panel(x,y,'S5','未找到的处理',True);head(x,y,'这里没找到','布洛芬 · 随身盒')
box(x+24,y+164,342,144,'surface',20)
txt(x+44,y+185,'黑色背包 / 前袋',22,bold=True);txt(x+44,y+225,'10 月 10 日 09:20',14,'muted')
box(x+44,y+257,100,30,'amber-soft',15);txt(x+57,y+264,'本次未找到',14,'amber')
txt(x+24,y+340,'这不代表已经用完。',21,bold=True)
txt(x+24,y+376,'暂无更多有效线索，可以先结束查找。',16,'muted',maxw=342)
button(x+24,y+444,'在别处找到，更新位置');center(x+24,y+516,'暂时结束查找');center(x+24,y+571,'查看历史记录','muted')

x=936
panel(x,y,'S6','新位置与历史',True)
ellipse(x+24,y+77,36,36,'green-soft');icon(x+30,y+83,'check','green');txt(x+72,y+80,'位置已更新',29,bold=True)
txt(x+24,y+127,'布洛芬 · 随身盒',16,'muted')
box(x+24,y+164,342,158,'surface',20)
txt(x+44,y+185,'行李箱',30,bold=True);txt(x+44,y+229,'内侧袋',23,bold=True);txt(x+44,y+283,'10 月 10 日 09:24 · 你确认的位置',14,'muted')
txt(x+24,y+351,'之前的线索',16,'muted',True)
line(x+32,y+395,x+32,y+450)
ellipse(x+28,y+394,8,8,'muted');txt(x+52,y+386,'10 月 8 日 · 记在黑色背包前袋',14,'muted')
ellipse(x+28,y+444,8,8,'muted');txt(x+52,y+436,'10 月 10 日 · 在那里没有找到',14,'muted')
button(x+24,y+493,'返回查找');foot(x,y,'位置之后仍可能发生变化')

txt(56,1760,'按线索寻找  →  反馈结果  →  保留历史，更新位置',16,'muted')
txt(936,1760,'内容优先 · 系统字体 · 语义颜色',14,'muted')
svg.append('</svg>')
(ROOT/'位置线索原型.svg').write_text('\n'.join(svg),encoding='utf-8')
im.save(ROOT/'位置线索原型.png')
for i,(x,y) in enumerate(panels,1):im.crop((x*S,y*S,(x+390)*S,(y+620)*S)).save(ROOT/f'S{i}.png')

def luminance(h):
    a=list(map(linear,rgb(h)));return sum(v*w for v,w in zip(a,[.2126,.7152,.0722]))
for a,b in [('ink','surface'),('muted','group'),('muted','surface'),('muted','canvas'),('accent-ink','accent'),('accent','tint'),('amber','amber-soft'),('green','green-soft')]:
    v=sorted([luminance(C[a]),luminance(C[b])]);ratio=(v[1]+.05)/(v[0]+.05);assert ratio>=4.5,(a,b,ratio);checks.append({'foreground':a,'background':b,'ratio':round(ratio,2)})
(ROOT/'visual-checks.json').write_text(json.dumps({'artifact':'static storyboard','text_width_assertions':'passed','contrast':checks,'responsive':'not applicable to fixed-size static SVG; app not implemented','font_preview':'DengXian on Windows; Apple system font stack in SVG'},ensure_ascii=False,indent=2),encoding='utf-8')
print('Rendered SVG, 2x PNG, six individual screens. Contrast and text width checks passed.')
