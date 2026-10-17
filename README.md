# AWS-Scalable-Web-App-Project

<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name=claude:viewport-fit-sides content=cover><style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}</style><style>.md-table{overflow-x:auto}@media print{.md-table{overflow-x:visible}}</style><style>:root{color-scheme:light dark;--md-bg:#fff;--md-text:rgba(0,0,0,.8);--md-muted:rgba(0,0,0,.6);--md-fill:rgba(0,0,0,.04);--md-fill-strong:rgba(0,0,0,.06);--md-rule:rgba(0,0,0,.1);--md-rule-strong:rgba(0,0,0,.16);--md-link:hsl(210 100% 45%)}@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){--md-bg:#0d0d0d;--md-text:rgba(255,255,255,.85);--md-muted:rgba(255,255,255,.6);--md-fill:rgba(255,255,255,.06);--md-fill-strong:rgba(255,255,255,.09);--md-rule:rgba(255,255,255,.14);--md-rule-strong:rgba(255,255,255,.22);--md-link:hsl(210 100% 72%)}}:root[data-theme="dark"]{color-scheme:dark;--md-bg:#0d0d0d;--md-text:rgba(255,255,255,.85);--md-muted:rgba(255,255,255,.6);--md-fill:rgba(255,255,255,.06);--md-fill-strong:rgba(255,255,255,.09);--md-rule:rgba(255,255,255,.14);--md-rule-strong:rgba(255,255,255,.22);--md-link:hsl(210 100% 72%)}:root[data-theme="light"]{color-scheme:light}@media print{:root,:root[data-theme="dark"]{color-scheme:light;--md-bg:#fff;--md-text:rgba(0,0,0,.8);--md-muted:rgba(0,0,0,.6);--md-fill:rgba(0,0,0,.04);--md-fill-strong:rgba(0,0,0,.06);--md-rule:rgba(0,0,0,.1);--md-rule-strong:rgba(0,0,0,.16);--md-link:hsl(210 100% 45%)}}body{background:var(--md-bg);color:var(--md-text);max-width:720px;margin:0 auto;padding:32px;display:flex;flex-direction:column;gap:10px;font:14px/1.55 -apple-system,BlinkMacSystemFont,'SF Pro','Segoe UI',sans-serif;overflow-wrap:break-word}body>:first-child{margin-top:0}h1,h2,h3,h4,h5,h6{margin:6px 0 0;line-height:1.25;font-weight:600;text-wrap:balance}h1{font-size:1.35em}h2{font-size:1.15em;color:var(--md-muted)}h3,h4,h5,h6{font-size:1em}p,ul,ol,blockquote,table,pre,hr{margin:0}strong{font-weight:600}a{color:var(--md-link);text-decoration:none}a:hover{text-decoration:underline}ul,ol{display:flex;flex-direction:column;gap:6px;padding-left:22px}ul{list-style:disc}ol{list-style:decimal}:is(li,td,th)>*+:is(p,ul,ol,blockquote){margin-top:6px}blockquote{display:flex;flex-direction:column;gap:10px;border-left:2px solid var(--md-rule);padding-left:10px;color:var(--md-muted)}:not(pre)>code{background:var(--md-fill);padding:1px 3px;border-radius:4px;font:.92em 'SF Mono',ui-monospace,Menlo,Consolas,monospace}a>code{background:none;color:inherit}pre{background:var(--md-fill);padding:10px 12px;border-radius:6px;overflow-x:auto;font:12px/1.5 'SF Mono',ui-monospace,Menlo,Consolas,monospace;margin-block:4px}pre code{background:none;padding:0;font:inherit}table{width:100%;border-collapse:separate;border-spacing:2px;font:inherit}th,td{padding:6px 8px;border-radius:3px;text-align:left;vertical-align:top}th{background:var(--md-fill-strong);font-weight:600}td{background:var(--md-fill)}:is(th,td) :not(pre)>code{background:transparent}hr{border:0;border-top:1px solid var(--md-rule-strong);margin-block:10px}img{max-width:100%;height:auto;border-radius:4px}</style>
</head><body>
<h1>Project 1: Scalable Web Application with ALB and Auto Scaling</h1>
<h2>Architecture Diagram</h2>
<pre class="mermaid">flowchart TB
    Users([&#34;Users / Internet&#34;])
    Admin([&#34;Cloud Admin / Ops&#34;])

    subgraph EDGE[&#34;Global Edge Layer&#34;]
        direction LR
        R53[&#34;Route 53&lt;br/&gt;DNS Alias Record&#34;]
        CF[&#34;CloudFront&lt;br/&gt;CDN + ACM TLS&#34;]
        WAF[&#34;AWS WAF&lt;br/&gt;Web ACL on CloudFront&#34;]
    end

    subgraph REGION[&#34;AWS Region&#34;]
        subgraph VPC[&#34;VPC 10.0.0.0/16&#34;]
            IGW[&#34;Internet Gateway&#34;]
            ALB[&#34;Application Load Balancer&lt;br/&gt;Spans Public Subnets A and B&lt;br/&gt;SG: alb-sg (CloudFront prefix list only)&#34;]
            ASG{{&#34;Auto Scaling Group&lt;br/&gt;Target Tracking: CPU / Requests per Target&lt;br/&gt;Min 2 / Desired 2 / Max N&#34;}}
            VPCE[&#34;VPC Interface Endpoints&lt;br/&gt;ssm, ssmmessages, ec2messages&#34;]

            subgraph AZA[&#34;Availability Zone A&#34;]
                subgraph PUBA[&#34;Public Subnet A 10.0.1.0/24&lt;br/&gt;NACL: public-nacl&#34;]
                    NATA[&#34;NAT Gateway A&#34;]
                end
                subgraph APPA[&#34;Private App Subnet A 10.0.11.0/24&lt;br/&gt;NACL: private-nacl&#34;]
                    EC2A[&#34;EC2 Instance A&lt;br/&gt;SG: app-sg&lt;br/&gt;SSM Agent + IAM Role&#34;]
                end
                subgraph DBA[&#34;Private DB Subnet A 10.0.21.0/24&lt;br/&gt;NACL: db-nacl&#34;]
                    RDSP[(&#34;RDS Primary&lt;br/&gt;MySQL / PostgreSQL&lt;br/&gt;SG: db-sg&#34;)]
                end
            end

            subgraph AZB[&#34;Availability Zone B&#34;]
                subgraph PUBB[&#34;Public Subnet B 10.0.2.0/24&lt;br/&gt;NACL: public-nacl&#34;]
                    NATB[&#34;NAT Gateway B&#34;]
                end
                subgraph APPB[&#34;Private App Subnet B 10.0.12.0/24&lt;br/&gt;NACL: private-nacl&#34;]
                    EC2B[&#34;EC2 Instance B&lt;br/&gt;SG: app-sg&lt;br/&gt;SSM Agent + IAM Role&#34;]
                end
                subgraph DBB[&#34;Private DB Subnet B 10.0.22.0/24&lt;br/&gt;NACL: db-nacl&#34;]
                    RDSS[(&#34;RDS Standby&lt;br/&gt;Multi-AZ Replica&lt;br/&gt;SG: db-sg&#34;)]
                end
            end
        end
    end

    subgraph MGMT[&#34;Management and Observability&#34;]
        direction LR
        SSM[&#34;Systems Manager&lt;br/&gt;Session Manager&#34;]
        CW[&#34;CloudWatch&lt;br/&gt;Metrics, Logs, Alarms&#34;]
        SNS[&#34;SNS Topic&lt;br/&gt;Alert Notifications&#34;]
    end

    %% Request path
    Users --&gt;|&#34;HTTPS&#34;| R53
    R53 --&gt; CF
    CF --&gt;|&#34;Inspected by&#34;| WAF
    WAF --&gt;|&#34;Filtered traffic + origin header&#34;| IGW
    IGW --&gt; ALB
    ALB --&gt;|&#34;HTTP/HTTPS&#34;| EC2A
    ALB --&gt;|&#34;HTTP/HTTPS&#34;| EC2B

    %% Auto Scaling
    ASG -.-&gt;|&#34;Launches / replaces&#34;| EC2A
    ASG -.-&gt;|&#34;Launches / replaces&#34;| EC2B

    %% Data layer
    EC2A --&gt;|&#34;3306 / 5432&#34;| RDSP
    EC2B --&gt;|&#34;3306 / 5432&#34;| RDSP
    RDSP &lt;--&gt;|&#34;Synchronous replication&#34;| RDSS

    %% Outbound internet access for private instances
    EC2A -.-&gt;|&#34;Egress&#34;| NATA
    EC2B -.-&gt;|&#34;Egress&#34;| NATB
    NATA -.-&gt; IGW
    NATB -.-&gt; IGW

    %% Admin access without SSH or bastion
    Admin --&gt;|&#34;IAM-authenticated&#34;| SSM
    SSM --&gt; VPCE
    VPCE --&gt;|&#34;Session&#34;| EC2A
    VPCE --&gt;|&#34;Session&#34;| EC2B

    %% Monitoring and alerting
    ALB -.-&gt;|&#34;Metrics&#34;| CW
    EC2A -.-&gt;|&#34;Metrics / Logs&#34;| CW
    EC2B -.-&gt;|&#34;Metrics / Logs&#34;| CW
    RDSP -.-&gt;|&#34;Metrics&#34;| CW
    CW ==&gt;|&#34;Alarms drive scaling policies&#34;| ASG
    CW --&gt;|&#34;Alarm actions&#34;| SNS
    SNS --&gt;|&#34;Email / SMS&#34;| Admin

    classDef edge fill:#fff4e5,stroke:#e08a00,color:#000
    classDef compute fill:#e8f1ff,stroke:#2b6cb0,color:#000
    classDef data fill:#e6f7ec,stroke:#2f855a,color:#000
    classDef mgmt fill:#f3e8ff,stroke:#7b3fb5,color:#000
    classDef net fill:#f1f1f1,stroke:#555,color:#000

    class R53,CF,WAF edge
    class ALB,ASG,EC2A,EC2B compute
    class RDSP,RDSS data
    class SSM,CW,SNS,VPCE mgmt
    class IGW,NATA,NATB net
</pre>
<h2>Legend</h2>
<div class="md-table" role="region" aria-label="Table" tabindex="0"><table>
<thead>
<tr>
<th>Line style</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td>Solid arrow</td>
<td>Primary request, data, or access path</td>
</tr>
<tr>
<td>Dotted arrow</td>
<td>Control plane, egress, or telemetry</td>
</tr>
<tr>
<td>Thick arrow</td>
<td>CloudWatch alarms triggering Auto Scaling</td>
</tr>
</tbody>
</table>
</div>


<!--claude-mermaid-runtime-begin:3477-->
<style>.mermaid-diagram{margin-block:4px}.mermaid-diagram svg{display:block;margin:0 auto;max-width:100%;height:auto}</style>
<script src="/_runtime/mermaid-11.16.1.min.js"></script>
<script>(function(){
var CFG={"palettes":{"light":{"surface":"#f4efe4","text":"#42392e","line":"#8a7f6d","border":"#7a6c52","bg":"#fffdf8"},"dark":{"surface":"#262b34","text":"#f2f3f5","line":"#a8adb8","border":"#9aa4b8","bg":"#1f232b"}}};
if(typeof mermaid==='undefined')return;
var pres=Array.prototype.slice.call(document.querySelectorAll('pre.mermaid')).filter(function(p){if(p.hasAttribute('data-claude-mermaid-claimed'))return false;p.setAttribute('data-claude-mermaid-claimed','1');return true;});
if(!pres.length)return;
var mq=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
var root=document.documentElement;
var items=pres.map(function(pre){
var mount=document.createElement('div');mount.className='mermaid-diagram';
return {pre:pre,mount:mount,src:pre.textContent||''};
});
var seq=0;
var renderGen=0;
var lastKey='';
function pageBg(fallback){
var els=[document.body,document.documentElement];
for(var i=0;i<els.length;i++){
var c=els[i]&&getComputedStyle(els[i]).backgroundColor;
if(c&&c!=='transparent'&&c!=='rgba(0, 0, 0, 0)')return c;
}
return fallback;
}
function render(){
var theme=root.getAttribute('data-theme');
var dark=theme==='dark'||(!!(mq&&mq.matches)&&theme!=='light');
var pal=dark?CFG.palettes.dark:CFG.palettes.light;
var bg=pageBg(pal.bg);
var key=(dark?'d':'l')+'|'+bg;
if(key===lastKey)return;
lastKey=key;
var gen=++renderGen;
var font=getComputedStyle(document.body).fontFamily||'sans-serif';
var nat={useMaxWidth:false};
mermaid.initialize({
startOnLoad:false,securityLevel:'strict',theme:'base',
flowchart:nat,sequence:nat,er:nat,state:nat,class:nat,pie:nat,
gantt:nat,journey:nat,timeline:nat,gitGraph:nat,mindmap:nat,xyChart:nat,
quadrantChart:nat,sankey:nat,c4:nat,requirement:nat,block:nat,
packet:nat,kanban:nat,architecture:nat,radar:nat,
themeVariables:{background:bg,mainBkg:pal.surface,primaryColor:pal.surface,
primaryTextColor:pal.text,lineColor:pal.line,primaryBorderColor:pal.border,
nodeBorder:pal.border,clusterBorder:pal.border,edgeLabelBackground:bg,
clusterBkg:'rgba(127,127,127,0.07)',titleColor:pal.text,
darkMode:dark,rowOdd:bg,rowEven:'rgba(127,127,127,0.07)',
attributeBackgroundColorOdd:bg,attributeBackgroundColorEven:'rgba(127,127,127,0.07)',
fontSize:'16px',fontFamily:font},
themeCSS:'.node rect, .node circle, .node polygon, .node path, .cluster rect { stroke-width: 2px; }'
});
items.forEach(function(it){
var id='claude-mermaid-'+seq++;
mermaid.render(id,it.src).then(function(r){
if(gen!==renderGen)return;
var prev=it.pre.previousElementSibling;
if(prev&&prev.className==='mermaid-diagram'&&prev!==it.mount)return;
it.mount.innerHTML=r.svg;
if(!it.mount.parentNode)it.pre.parentNode.insertBefore(it.mount,it.pre);
it.pre.style.display='none';
},function(){
var scratch=document.getElementById(id);
if(scratch)scratch.parentNode.removeChild(scratch);
scratch=document.getElementById('d'+id);
if(scratch)scratch.parentNode.removeChild(scratch);
if(gen!==renderGen)return;
if(it.mount.parentNode)it.mount.parentNode.removeChild(it.mount);
it.pre.style.display='';
});
});
}
render();
if(mq&&mq.addEventListener)mq.addEventListener('change',render);
if(typeof MutationObserver!=='undefined')new MutationObserver(render).observe(root,{attributes:true,attributeFilter:['data-theme']});
})();</script>
<!--claude-mermaid-runtime-end-->
</body></html>
