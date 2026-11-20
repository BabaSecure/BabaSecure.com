from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)
FILE = OUT / "BabaSecure-Invoice-0017.pdf"
W, H = A4
NAVY, BLUE, INK = HexColor("#081426"), HexColor("#1769E8"), HexColor("#14213A")
MUTED, LINE, PALE = HexColor("#6D7A8E"), HexColor("#D9E2EF"), HexColor("#F4F8FF")

def label(c, txt, x, y):
    c.setFillColor(MUTED); c.setFont("Helvetica-Bold", 7.5); c.drawString(x, y, txt.upper())

def rule(c, x1, y, x2):
    c.setStrokeColor(LINE); c.setLineWidth(.7); c.line(x1, y, x2, y)

def text(c, txt, x, y, font="Helvetica", size=9, color=INK):
    c.setFillColor(color); c.setFont(font, size); c.drawString(x, y, txt)

def main():
    c = canvas.Canvas(str(FILE), pagesize=A4, pageCompression=1)
    c.setTitle("BabaSecure Invoice 0017")
    c.setAuthor("BabaSecure")
    # header
    c.setFillColor(NAVY); c.rect(0, H-154, W, 154, fill=1, stroke=0)
    c.setFillColor(BLUE); c.rect(0, H-154, 8, 154, fill=1, stroke=0)
    logo = ROOT / "BabaSecure nobg.png"
    c.drawImage(str(logo), 46, H-102, width=47, height=47, preserveAspectRatio=True, mask="auto")
    text(c,"Baba",104,H-75,"Helvetica-Bold",20,white); text(c,"Secure",151,H-75,"Helvetica-Bold",20,HexColor("#63A4FF"))
    text(c,"SECURE TODAY, PROTECT TOMORROW",105,H-91,"Helvetica",8.2,HexColor("#A9BAD3"))
    c.setFillColor(white); c.setFont("Helvetica-Bold",31); c.drawRightString(W-46,H-76,"INVOICE")
    c.setFillColor(HexColor("#A9BAD3")); c.setFont("Helvetica",8.5); c.drawRightString(W-46,H-95,"CYBERSECURITY CONSULTING")
    # info
    y=H-190
    for x,title,value in [(46,"Invoice number","0017"),(205,"Issue date","13/07/2026"),(337,"Due date","13/08/2026")]:
        label(c,title,x,y); text(c,value,x,y-25,"Helvetica-Bold",10); rule(c,x,y-34,x+105)
    c.setFillColor(PALE); c.roundRect(475,y-42,73,37,5,fill=1,stroke=0); label(c,"Status",487,y-19); text(c,"DUE",487,y-36,"Helvetica-Bold",9,BLUE)
    # address panels
    by=H-275
    c.setFillColor(HexColor("#EAF2FF")); c.roundRect(46,by-112,244,131,6,fill=1,stroke=0)
    c.setFillColor(HexColor("#F7FAFF")); c.roundRect(312,by-112,236,131,6,fill=1,stroke=0)
    label(c,"To",61,by); label(c,"From",327,by)
    text(c,"BERNADETTE JOHNNY",61,by-26,"Helvetica-Bold",10); text(c,"charmingbernadette1@gmail.com",61,by-43,"Helvetica",8.4,MUTED)
    text(c,"35 Moatfield Avenue, Donaghmede, Dublin,",61,by-64,"Helvetica",8.3,INK); text(c,"Co. Dublin, D05 Y9W9",61,by-79,"Helvetica",8.3,INK); text(c,"Ireland",61,by-94,"Helvetica",8.3,INK)
    text(c,"hi@BabaSecure.com",327,by-27,"Helvetica-Bold",10,INK)
    # table
    tx,tw,top=46,W-92,H-430
    c.setFillColor(NAVY); c.roundRect(tx,top,tw,27,4,fill=1,stroke=0)
    for x,h in [(tx+14,"SERVICE"),(tx+392,"AMOUNT")]: text(c,h,x,top+10,"Helvetica-Bold",7.5,white)
    c.setFillColor(white); c.rect(tx,top-82,tw,82,fill=1,stroke=0); rule(c,tx,top-82,tx+tw)
    text(c,"Cybersecurity research project",tx+14,top-31,"Helvetica-Bold",10)
    text(c,"HIPAA Home Care Case studies",tx+14,top-52,"Helvetica",9,MUTED)
    c.setFillColor(INK); c.setFont("Helvetica-Bold",12); c.drawRightString(tx+tw-15,top-43,"EUR 132.00")
    # payment details
    py=top-132
    label(c,"Payment details",46,py+71)
    c.setFillColor(PALE); c.roundRect(46,py-47,318,105,6,fill=1,stroke=0)
    payment=["IBAN: LU884080000045681082","BIC: BCIRLULL","Account Holder Name: Bridge Building S.A.","Account Type: Individual Checking","Bank Name: Banking Circle S.A.","Bank Address: 2 Boulevard de la Foire, L-1528 Luxembourg"]
    for i,line in enumerate(payment): text(c,line,62,py+39-i*15,"Helvetica",8.2,INK)
    # total card
    c.setFillColor(NAVY); c.roundRect(390,py-14,158,72,6,fill=1,stroke=0)
    text(c,"Tax",405,py+37,"Helvetica",8.5,HexColor("#BDCCE2")); c.setFillColor(white); c.setFont("Helvetica",9); c.drawRightString(533,py+37,"EUR 0.00")
    c.setStrokeColor(HexColor("#324761")); c.line(405,py+25,533,py+25)
    text(c,"TOTAL DUE",405,py+5,"Helvetica-Bold",8.5,white); c.setFillColor(HexColor("#78B4FF")); c.setFont("Helvetica-Bold",14); c.drawRightString(533,py+3,"EUR 132.00")
    # footer - the only site address, centered
    c.setFillColor(NAVY); c.rect(0,0,W,50,fill=1,stroke=0)
    c.setFillColor(HexColor("#7DB5FF")); c.setFont("Helvetica-Bold",9); c.drawCentredString(W/2,21,"BabaSecure.com")
    c.save(); print(FILE)

if __name__ == "__main__": main()
