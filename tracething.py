#!/usr/bin/python3
from scapy.all import *
from random import randrange

BASEADDR = '2a0f:9400:7312:1337:1::'
BASENET = '2a0f:9400:7312:1337:2::'

def mk_pong(echoreq):
    pkt = IPv6(dst=echoreq[1].src,src=echoreq[1].dst)/ICMPv6EchoReply()
    pkt.data = echoreq[2].data
    pkt.seq = echoreq[2].seq
    pkt.id = echoreq[2].id
    return pkt

def mk_timeout(req, src):
    pkt = IPv6(dst=req[1].src, src=src)/ICMPv6TimeExceeded()/req[1:]
    return pkt

def resp(pkt, tosend):
    sendp(Ether(src=pkt[0].dst,dst=pkt[0].src)/tosend, verbose=0)

def handle_pkt(pkt):
    dst = pkt[1].dst
    if dst.startswith(BASENET):
        resp(pkt, mk_pong(pkt))
        return

    if not dst.startswith(BASEADDR):
        return
 
    net = dst[len(BASEADDR):]

    src = pkt[1].src
    hop = pkt[1].hlim

    if hop > 30:
        resp(pkt, mk_pong(pkt))
        return

    resp(pkt, mk_timeout(pkt, "%s%x:%s" % (BASENET, hop, net)))


sniff(filter="icmp6 && ip6[40] == 128", prn=handle_pkt)