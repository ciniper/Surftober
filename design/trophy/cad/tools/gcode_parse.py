import re, sys, collections
def parse(path):
    tool=0; z=0; x=y=0; segs=collections.defaultdict(list); w=0.42
    for ln in open(path):
        if ln.startswith(';'):
            m=re.match(r'; Z_HEIGHT: ([\d.]+)',ln)
            if m: z=float(m.group(1))
            m=re.match(r'; LINE_WIDTH: ([\d.]+)',ln)
            if m: w=float(m.group(1))
            continue
        s=ln.split(';')[0].strip()
        if re.fullmatch(r'T\d+',s): tool=int(s[1:]); continue
        if s.startswith(('G1','G0','G2','G3')):
            d=dict((t[0],float(t[1:])) for t in s.split()[1:] if t[0] in 'XYZEIJF' and len(t)>1)
            nx,ny=d.get('X',x),d.get('Y',y)
            if d.get('E',0)>0 and (nx,ny)!=(x,y) :
                if s.startswith(('G2','G3')) and ('I' in d or 'J' in d):
                    import math
                    cx,cy=x+d.get('I',0),y+d.get('J',0); r=math.hypot(x-cx,y-cy)
                    a0=math.atan2(y-cy,x-cx); a1=math.atan2(ny-cy,nx-cx); cw=s.startswith('G2')
                    da=a1-a0
                    if cw and da>=0: da-=2*math.pi
                    if not cw and da<=0: da+=2*math.pi
                    n=max(2,int(abs(da)*r/0.15)); px,py=x,y
                    for i in range(1,n+1):
                        t=a0+da*i/n; qx,qy=(cx+r*math.cos(t),cy+r*math.sin(t)) if i<n else (nx,ny)
                        segs[(z,tool)].append((px,py,qx,qy,w)); px,py=qx,qy
                else:
                    segs[(z,tool)].append((x,y,nx,ny,w))
            x,y=nx,ny
    return segs
if __name__=='__main__':
    s=parse(sys.argv[1])
    zs=sorted(set(k[0] for k in s))
    for z in zs[-8:]:
        print(z, {k[1]:len(v) for k,v in s.items() if k[0]==z})
    import itertools
    for tl in (1,2):
        pts=[(a,b) for k,v in s.items() if k[1]==tl for a,b,_,_,_ in v]
        if pts: print('tool',tl,'x',min(p[0] for p in pts),max(p[0] for p in pts),'y',min(p[1] for p in pts),max(p[1] for p in pts))
