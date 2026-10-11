"""Independent public-reader CLI; content stays untrusted."""
import argparse
import json
import sys
from . import fetch
from .surrogate import load_surrogates

def build_parser():
    parser=argparse.ArgumentParser(description="Scrum public-page retrieval with provenance")
    parser.add_argument("url")
    parser.add_argument("--selector","-s",action="append",dest="selectors")
    parser.add_argument("--device",choices=["auto","desktop","mobile"],default="auto")
    parser.add_argument("--timeout",type=int,default=25)
    parser.add_argument("--max-attempts",type=int)
    for flag in ["no-playwright","allow-proxy","json","json-content","trace","no-phase0","no-extract","no-markdown","no-retry"]:parser.add_argument("--"+flag,action="store_true")
    parser.add_argument("--surrogates")
    return parser

def main(argv=None):
    args=build_parser().parse_args(argv)
    if not 0<args.timeout<=600:raise ValueError("Timeout must be 1–600 seconds")
    if args.max_attempts is not None and args.max_attempts<1:raise ValueError("Attempt budget must be positive")
    result=fetch(args.url,success_selectors=args.selectors,device_class=args.device,timeout=args.timeout,max_attempts=args.max_attempts,enable_playwright=not args.no_playwright,allow_surrogate_proxy=args.allow_proxy,surrogate_registry=load_surrogates(args.surrogates),enable_phase0=not args.no_phase0,enable_extraction=not args.no_extract,enable_markdown=not args.no_markdown,enable_retry=not args.no_retry)
    if args.json or args.json_content:
        data=result.to_dict()
        if args.json_content:data["untrusted_text"]=result.to_untrusted_text()
        print(json.dumps(data,ensure_ascii=False,default=str))
    else:
        print(result.to_untrusted_text())
        print(result.summary,file=sys.stderr)
        print("Retrieval provenance: "+result.provenance+"; trust: "+result.trust+"; capture timestamp: "+str(result.snapshot_timestamp or "unknown"),file=sys.stderr)
    if args.trace:
        for attempt in result.trace:print(json.dumps(attempt.to_dict(),default=str),file=sys.stderr)
    return 0 if result.ok else 1

if __name__=="__main__":
    try:raise SystemExit(main())
    except Exception as error:
        print("Public retrieval failed: "+type(error).__name__,file=sys.stderr)
        raise SystemExit(2)
