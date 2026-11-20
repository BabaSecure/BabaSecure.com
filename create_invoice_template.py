from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase.pdfmetrics import stringWidth

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)
FILE = OUT / "Babasecure-Invoice-Template.pdf"

W, H = A4
NAVY = HexColor("#081426")
BLUE = HexColor("#1769E8")
PALE = HexColor("#EDF4FF")
INK = HexColor("#14213A")
MUTED = HexColor("#6D7A8E")
LINE = HexColor("#D9E2EF")
WHITE = white

def field(form, name, x, y, width, height=18, value="", font=9, multiline=False, align="left"):
    flags = 4096 if multiline else 0
    form.textfield(
        name=name, value=value, x=x, y=y, width=width, height=height,
        borderWidth=0, fillColor=None, textColor=INK, fontName="Helvetica",
        fontSize=font, fieldFlags=flags, forceBorder=False,
    )

def label(c, text, x, y):
    c.setFillColor(MUTED); c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x, y, text.upper())

def rule(c, x1, y, x2):
    c.setStrokeColor(LINE); c.setLineWidth(.6); c.line(x1, y, x2, y)

def main():
    c = canvas.Canvas(str(FILE), pagesize=A4, pageCompression=1)
    c.setTitle("Babasecure Invoice Template")
    c.setAuthor("Babasecure")
    c.setSubject("Reusable fillable invoice template")
    form = c.acroForm

    # Header
    c.setFillColor(NAVY); c.rect(0, H-155, W, 155, fill=1, stroke=0)
    c.setFillColor(BLUE); c.rect(0, H-155, 8, 155, fill=1, stroke=0)
    logo = ROOT / "BabaSecure nobg.png"
    if logo.exists():
        c.drawImage(str(logo), 46, H-102, width=47, height=47, preserveAspectRatio=True, mask='auto')
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 20)
    c.drawString(104, H-75, "Baba")
    c.setFillColor(HexColor("#63A4FF")); c.drawString(151, H-75, "Secure")
    c.setFillColor(HexColor("#A9BAD3")); c.setFont("Helvetica", 8.2)
    c.drawString(105, H-91, "SECURE TODAY, PROTECT TOMORROW")
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 31)
    c.drawRightString(W-46, H-76, "INVOICE")
    c.setFillColor(HexColor("#A9BAD3")); c.setFont("Helvetica", 8.5)
    c.drawRightString(W-46, H-95, "CYBERSECURITY CONSULTING")

    # invoice meta
    meta_y = H-190
    for x, title, name, width in [(46, "Invoice number", "invoice_number", 130), (205, "Issue date", "issue_date", 105), (337, "Due date", "due_date", 105)]:
        label(c, title, x, meta_y); field(form, name, x, meta_y-30, width, value="", font=10); rule(c, x, meta_y-34, x+width)
    c.setFillColor(PALE); c.roundRect(475, meta_y-42, 73, 37, 5, fill=1, stroke=0)
    label(c, "Status", 487, meta_y-19); field(form, "payment_status", 487, meta_y-38, 50, 15, value="DRAFT", font=8)

    # bill to / from
    block_y = H-275
    c.setFillColor(PALE); c.roundRect(46, block_y-102, 244, 121, 6, fill=1, stroke=0)
    c.setFillColor(HexColor("#F7FAFF")); c.roundRect(312, block_y-102, 236, 121, 6, fill=1, stroke=0)
    label(c, "Bill to", 61, block_y); label(c, "From", 327, block_y)
    field(form, "client_name", 61, block_y-29, 214, 18, value="Client name", font=10)
    field(form, "client_address", 61, block_y-70, 214, 35, value="Client address\nCity, Country", font=8.5, multiline=True)
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 11); c.drawString(327, block_y-28, "Babasecure")
    c.setFillColor(MUTED); c.setFont("Helvetica", 8.5); c.drawString(327, block_y-45, "hi@babasecure.com")
    c.drawString(327, block_y-60, "babasecure.com")
    c.drawString(327, block_y-75, "Cybersecurity Consulting")

    # table
    tx, tw, top = 46, W-92, H-415
    c.setFillColor(NAVY); c.roundRect(tx, top, tw, 27, 4, fill=1, stroke=0)
    heads = [(tx+14,"DESCRIPTION"),(tx+302,"QTY"),(tx+364,"RATE"),(tx+447,"AMOUNT")]
    c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 7.5)
    for x, h in heads: c.drawString(x, top+10, h)
    rows = [("service_1","description_1","qty_1","rate_1","amount_1"), ("service_2","description_2","qty_2","rate_2","amount_2"), ("service_3","description_3","qty_3","rate_3","amount_3"), ("service_4","description_4","qty_4","rate_4","amount_4")]
    rowh=42
    for i, (_, desc, qty, rate, amount) in enumerate(rows):
        y=top-(i+1)*rowh
        c.setFillColor(HexColor("#FFFFFF") if i%2==0 else HexColor("#F8FAFD")); c.rect(tx,y,tw,rowh,fill=1,stroke=0)
        rule(c,tx,y,tx+tw)
        field(form, desc, tx+13, y+11, 270, 18, value="Service description",font=8.5)
        field(form, qty, tx+302, y+11, 42, 18, value="1",font=8.5)
        field(form, rate, tx+364, y+11, 62, 18, value="0.00",font=8.5)
        field(form, amount, tx+447, y+11, 47, 18, value="0.00",font=8.5)

    # notes and totals
    lower = top-4*rowh-82
    label(c,"Notes",46,lower+70); field(form,"notes",46,lower,295,58,value="Thank you for choosing Babasecure.",font=8.5,multiline=True)
    rule(c,46,lower-3,341)
    totals_x = 384
    for i, (title, name, value, bold) in enumerate([( "Subtotal", "subtotal", "0.00", False),("Tax", "tax", "0.00", False),("Total due", "total_due", "0.00", True)]):
        y=lower+55-i*27
        if bold:
            c.setFillColor(NAVY); c.roundRect(totals_x-10,y-9,174,28,4,fill=1,stroke=0)
            c.setFillColor(WHITE); c.setFont("Helvetica-Bold",9)
        else:
            c.setFillColor(MUTED); c.setFont("Helvetica",8.5)
        c.drawString(totals_x,y,title)
        field(form,name,totals_x+91,y-7,60,17,value=value,font=8.5)

    # footer
    c.setFillColor(NAVY); c.rect(0, 0, W, 57, fill=1, stroke=0)
    c.setFillColor(HexColor("#C1D1E8")); c.setFont("Helvetica",8)
    c.drawString(46,31,"Payment details / bank information:")
    field(form,"payment_details",218,20,245,20,value="Add payment instructions here",font=8.2)
    c.setFillColor(HexColor("#7DB5FF")); c.setFont("Helvetica-Bold",8)
    c.drawRightString(W-46,31,"hi@babasecure.com")
    c.save()
    print(FILE)

if __name__ == "__main__": main()
