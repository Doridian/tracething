import { DNSPacket, DNSReplyFunc, DNSServer, DNS_CLASS, DNS_RCODE, DNS_TYPE, DNSAnswer, IPAddress } from "@doridian/dnsd";
import { getDNSModule } from "./module";

const BASEADDR = '2a0f:9400:7311:1337:1::';

export interface IPSetData {
    name: string;
    trace: string[];
}

class TracethingDNSServer extends DNSServer {
    private ipsetByName: { [key: string]: DNSAnswer } = {};
    private allocatedIPSets: IPSetData[] = [];
    private nextIPSet = 0;

    protected handle(packet: DNSPacket, reply: DNSReplyFunc): void {
        if (packet.questions.length !== 1) {
            reply([], DNS_RCODE.FORMERR);
            return;
        }

        const q = packet.questions[0];
        if (q.class !== DNS_CLASS.IN) {
            reply([]);
            return;
        }

        if (q.type === DNS_TYPE.AAAA) {
            this.fetchAAAA(q.name).then(r => reply(r)).catch((err) => console.error(err.stack || err));
            return;
        }

        if (q.type === DNS_TYPE.PTR) {
            this.fetchPTR(q.name).then(r => reply(r)).catch((err) => console.error(err.stack || err));
            return;
        }

        if (q.type === DNS_TYPE.NS) {
            const a1 = new DNSAnswer();
            a1.class = DNS_CLASS.IN;
            a1.type = DNS_TYPE.NS;
            a1.name = q.name;
            a1.ttl = 60;
            a1.setData("nsthing.pawnode.com");

            reply([a1]);
            return;
        }

        reply([]);
    }

    private getNextIPSet() {
        if (this.nextIPSet > 60000) {
            this.nextIPSet = 0;
        }
        return this.nextIPSet++;
    }

    protected async fetchAAAA(name: string): Promise<DNSAnswer[]> {
        if (!name.endsWith('.thing.f0x.es')) {
            return [];
        }

        if (this.ipsetByName[name]) {
            return [this.ipsetByName[name]];
        }

        const spls = name.split('.');
        spls.pop();
        spls.pop();
        spls.pop();
        const dnsModule = getDNSModule(spls.pop()!);

        if (!dnsModule) {
            return [];
        }

        const answers: IPSetData = {
            name,
            trace: await dnsModule.handle(spls),
        };

        const id = this.getNextIPSet();
        if (this.allocatedIPSets[id]) {
            delete this.ipsetByName[this.allocatedIPSets[id].name];
        }
        this.allocatedIPSets[id] = answers;

        const a = new DNSAnswer();
        a.class = DNS_CLASS.IN;
        a.type = DNS_TYPE.AAAA;
        a.name = name;
        a.ttl = 60;
        a.setData(IPAddress.fromString(`${BASEADDR}${id.toString(16)}`));
        this.ipsetByName[name] = a;
        return [a];
    }

    protected async fetchPTR(name: string): Promise<DNSAnswer[]> {
        if (!name.endsWith('.ip6.arpa')) {
            return [];
        }

        const spl = name.split('.');
        if (spl.length !== 32 + 2)  {
            return [];
        }

	    if (name === '6.6.6.6.6.6.6.6.6.6.6.6.6.6.6.6.7.3.3.1.1.1.3.7.0.0.4.9.f.0.a.2.ip6.arpa') {
	        const a = new DNSAnswer();
	        a.class = DNS_CLASS.IN;
	        a.type = DNS_TYPE.PTR;
	        a.name = name;
	        a.ttl = 60;
		    a.setDataRaw(Buffer.from("<img src=https://doridian.net/icon.jpg />", "ascii"));
		    return [a];
    	}

        // 0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.1.3.7.0.0.4.9.f.0.a.2.ip6.arpa
        // From the end
        // 4 = ipsetID
        // 4 = answerID
        // 4 = 0
        // 4 = 1/2
        const ipsetID = parseInt(spl[3] + spl[2] + spl[1] + spl[0], 16);
        const answerID = parseInt(spl[7] + spl[6] + spl[5] + spl[4], 16);
        // const zero = parseInt(spl[11] + spl[10] + spl[9] + spl[8], 16);
        const type = parseInt(spl[15] + spl[14] + spl[13] + spl[12], 16);
        
        const ipset = this.allocatedIPSets[ipsetID];

        if (!ipset) {
            return [];
        }

        const a = new DNSAnswer();
        a.class = DNS_CLASS.IN;
        a.type = DNS_TYPE.PTR;
        a.name = name;
        a.ttl = 60;

        switch (type) {
            case 1:
                a.setData(ipset.name);
                break;
            case 2:
                a.setData(`${ipset.trace[answerID] || "end-of-the-line"}.0--0.f0x.es`);
                break;
            default:
                return [];
        }

        return [a];
    }
}

const server = new TracethingDNSServer(53, "2a0f:9400:7311::1", "udp6");
server.listen(() => console.log("Ready"));
