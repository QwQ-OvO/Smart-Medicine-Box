"""Generate editable SVG and matching PNG wireframes. No application behavior."""
from pathlib import Path
from html import escape
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
W, H = 1240, 1500
COLORS = dict(bg='#EFF3F2', paper='#FFFFFF', text='#183832', muted='#50665F', line='#D4DFDB', accent='#176455', soft='#E5F1EC', warn='#F5EEDC')
im = Image.new('RGB', (W, H), COLORS['bg'])
d = ImageDraw.Draw(im)
font = 'C:/Windows/Fonts/msyh.ttc'
bold = 'C:/Windows/Fonts/msyhbd.ttc'
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc"><title id="title">家庭药箱位置线索原型</title><desc id="desc">六个静态界面：找药、记位置、核对、线索、未找到、更新完成。全部为演示数据。</desc>', f'<rect width="{W}" height="{H}" fill="{COLORS["bg"]}"/>']

def box(x,y,w,h,fill='paper',r=10,stroke=None):
    c=COLORS[fill]
    d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=c,outline=COLORS[stroke] if stroke else None,width=1)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}"'+(f' stroke="{COLORS[stroke]}"' if stroke else '')+'/>')

def text(x,y,s,size=16,color='text',weight=False):
    f=ImageFont.truetype(bold if weight else font,size)
    d.text((x,y),s,font=f,fill=COLORS[color])
    svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Microsoft YaHei, sans-serif" font-size="{size}" font-weight="{700 if weight else 400}" fill="{COLORS[color]}">{escape(s)}</text>')

def button(x,y,s,primary=True):
    box(x,y,312,48,'accent' if primary else 'paper',8,None if primary else 'line')
    text(x+16,y+12,s,16,'paper' if primary else 'accent',True)

def panel(x,y,n,title,subtitle):
    text(x,y-34,n+'  '+title,20,weight=True)
    box(x,y,360,530,stroke='line')
    text(x+24,y+24,'药箱 · 位置线索',14,'muted')
    text(x+24,y+65,title,27,weight=True)
    text(x+24,y+110,subtitle,14,'muted')

text(40,30,'家庭药箱位置线索',34,weight=True)
text(40,80,'初步产品设计  /  六个核心状态  /  v0.1',18,'muted')
text(40,116,'静态线框稿，按钮不可操作；全部药品、位置与时间为演示数据。',16,'muted')

x,y=40,218
panel(x,y,'S1','先找哪一盒？','输入已经明确的药名，查看已有线索。')
box(x+24,y+154,312,52,stroke='line');text(x+38,y+168,'布洛芬',18)
button(x+24,y+226,'查找位置线索')
text(x+24,y+310,'刚整理完药箱？',18,weight=True)
text(x+24,y+347,'留下一条位置记录，下次查找时参考。',14,'muted')
button(x+24,y+389,'记一个位置',False)
text(x+24,y+478,'这里只展示记录，不代表实时库存。',14,'muted')

x=440
panel(x,y,'S2','记一个位置','整理或放置时，用一句话留下线索。')
box(x+24,y+154,312,130,stroke='line')
text(x+38,y+170,'这盒布洛芬放在',18)
text(x+38,y+202,'黑色背包前袋。',18)
text(x+24,y+306,'AI 整理后，由你核对再保存。',14,'muted')
button(x+24,y+352,'整理这句话')
button(x+24,y+416,'手工填写',False)

x=840
panel(x,y,'S3','核对这条记录','AI 整理的内容可以修改。')
for off,label,value in [(150,'药品名称','布洛芬'),(235,'包装标签 · 用来区分同名药','随身盒'),(320,'位置','黑色背包 / 前袋')]:
    text(x+24,y+off,label,14,'muted');box(x+24,y+off+27,312,46,stroke='line');text(x+38,y+off+37,value,17)
button(x+24,y+422,'确认并保存')
text(x+24,y+488,'未确认的内容不会成为位置记录。',14,'muted')

y=868;x=40
panel(x,y,'S4','最近的位置线索','布洛芬 · 随身盒')
box(x+24,y+150,312,190,'soft')
text(x+40,y+168,'黑色背包 / 前袋',23,weight=True)
text(x+40,y+212,'记录于 10 月 8 日 18:30',14,'muted')
text(x+40,y+242,'来源：你确认的位置',14,'muted')
text(x+40,y+286,'当前是否仍在：未确认',16,weight=True)
button(x+24,y+366,'在这里找到了')
button(x+24,y+430,'这里没找到',False)

x=440
panel(x,y,'S5','这里没找到','布洛芬 · 随身盒')
box(x+24,y+150,312,164,'warn')
text(x+40,y+166,'黑色背包 / 前袋',21,weight=True)
text(x+40,y+208,'10 月 10 日 09:20 · 本次未找到',14,'muted')
text(x+40,y+246,'这不代表已经用完。',16,weight=True)
text(x+40,y+276,'暂无更多有效线索。',14,'muted')
button(x+24,y+344,'在别处找到了，更新位置')
button(x+24,y+408,'暂时结束查找',False)
text(x+24,y+482,'查看历史记录 →',14,'accent')

x=840
panel(x,y,'S6','新位置已记录','布洛芬 · 随身盒')
box(x+24,y+150,312,112,'soft')
text(x+40,y+166,'行李箱 / 内侧袋',23,weight=True)
text(x+40,y+212,'你于 10 月 10 日 09:24 确认',14,'muted')
text(x+24,y+292,'之前的记录',17,weight=True)
text(x+24,y+329,'10 月 8 日 · 记在黑色背包前袋',14,'muted')
text(x+24,y+361,'10 月 10 日 · 在那里没有找到',14,'muted')
button(x+24,y+414,'返回查找')
text(x+24,y+484,'记录保留，之后仍可能发生移动。',14,'muted')

text(40,770,'记录：S1 → S2 → S3 → S4；查找：S1 → S4；未找到：S4 → S5 → 填写新位置 → S6。',15,'muted')
text(40,1430,'评审重点：记录发生在什么时机？历史位置是否被误读？找不到后能否继续或结束？',17,weight=True)
svg.append('</svg>')
(ROOT/'位置线索原型.svg').write_text('\n'.join(svg),encoding='utf-8')
im.save(ROOT/'位置线索原型.png')
print('Generated SVG and PNG:', W, H)
