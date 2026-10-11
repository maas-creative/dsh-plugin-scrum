import dataclasses, datetime, importlib, pathlib, sys, unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent/'independent'))
import public_reader_adapter as adapter
import public_reader_surrogates as surrogate
from public_reader_validation import surrogate_dead_end

BODY='<html><head><title>Independent article</title></head><body><article>'+('Verified public text. '*40)+'</article></body></html>'
TARGET='https://example.com/article'
class AdapterTests(unittest.TestCase):
 def test_archive_identity_timestamp_and_no_proxy_admission(self):
  registry={'archive':{'kind':'archive','discovery':{'url':'https://archive.org/wayback/available?url={target_encoded}','flag_pointer':'/archived_snapshots/closest/available','snapshot_url_pointer':'/archived_snapshots/closest/url','snapshot_timestamp_pointer':'/archived_snapshots/closest/timestamp'},'snapshot_host':'web.archive.org','require_embedded_target':True}}
  import json
  snapshot='https://web.archive.org/web/20261011000000/'+TARGET
  discovery=surrogate.PublicResponse(200,json.dumps({'archived_snapshots':{'closest':{'available':True,'url':snapshot,'timestamp':'20261011000000'}}}).encode(),'https://archive.org/wayback/available',{})
  captured=surrogate.PublicResponse(200,BODY.encode(),snapshot,{'content-type':'text/html'})
  with patch.object(surrogate,'public_request',side_effect=[discovery,captured]) as request:
   traces,meta,body=surrogate.run_surrogate(TARGET,registry=registry)
   self.assertEqual(meta['provenance'],'snapshot');self.assertEqual(meta['snapshot_timestamp'],'20261011000000');self.assertEqual(meta['trust'],'archive');self.assertEqual(body,BODY);self.assertEqual(request.call_count,2)
  bad=surrogate.PublicResponse(200,json.dumps({'archived_snapshots':{'closest':{'available':True,'url':'https://web.archive.org/web/20261011000000/https://other.example/article','timestamp':'20261011000000'}}}).encode(),'https://archive.org/wayback/available',{})
  with patch.object(surrogate,'public_request',return_value=bad) as request:
   _,_,body=surrogate.run_surrogate(TARGET,registry=registry);self.assertEqual(body,'');self.assertEqual(request.call_count,1)
  with patch.object(surrogate,'public_request') as request:
   traces,_,body=surrogate.run_surrogate(TARGET,registry={'proxy':{'kind':'proxy','fetch':'https://relay.invalid/{target}'}})
   self.assertIn('proxy_requires',traces[0].error);request.assert_not_called()
 def test_stale_dates_and_dead_ends(self):
  self.assertTrue(surrogate.is_stale({'last_verified':'2026-01-01'},today='2026-10-11'))
  self.assertFalse(surrogate.is_stale({'last_verified':datetime.date(2026,10,10)},today='2026-10-11'))
  self.assertTrue(surrogate_dead_end('<title>Redirecting</title><meta http-equiv="refresh" content="0;url=/article">',TARGET))
  self.assertFalse(surrogate_dead_end(BODY,TARGET))
 def test_result_keeps_legacy_positional_contract_and_untrusted_content(self):
  result=adapter.FetchResult(True,BODY,TARGET,'weak_ok',None,[],'done','snapshot','20261011000000','archive')
  self.assertEqual(result.to_dict()['provenance'],'snapshot');self.assertEqual(result.to_dict()['trust'],'archive');self.assertIn(BODY,result.to_untrusted_text())
  with self.assertRaises(ValueError):adapter.FetchResult(True,provenance='proxy',trust='origin')
 def test_surrogate_precedes_browser_and_snapshot_is_never_live(self):
  failed=adapter.native.FetchResult(False,final_url=TARGET,verdict='challenge',trace=[])
  attempt=adapter.native.Attempt('surrogate','surrogate_fixture',TARGET,'original',None,'',status=200,verdict='weak_ok')
  executor=importlib.import_module(adapter.native.__name__+'.executor')
  with patch.object(adapter.native,'fetch',return_value=failed),patch.object(adapter,'run_surrogate',return_value=([attempt],{'provenance':'snapshot','trust':'archive','snapshot_timestamp':'20261011000000'},BODY)),patch.object(executor,'run_playwright_fallback') as browser:
   result=adapter.fetch(TARGET);self.assertTrue(result.ok);self.assertEqual(result.provenance,'snapshot');browser.assert_not_called()
 def test_mcp_stub_does_not_exhaust_real_browser_budget(self):
  failed=adapter.native.FetchResult(False,final_url=TARGET,verdict='challenge',trace=[])
  profiles=importlib.import_module(adapter.native.__name__+'.waf_detector');executor=importlib.import_module(adapter.native.__name__+'.executor')
  def browser(url,**kwargs):
   route=kwargs['force_executor'];return adapter.native.Attempt('fallback',route,url,'original',None,'',status=200,verdict='weak_ok' if route=='playwright_real_chrome' else 'unknown'),BODY if route=='playwright_real_chrome' else ''
  with patch.object(adapter.native,'fetch',return_value=failed),patch.object(adapter,'run_surrogate',return_value=([],{'provenance':'live'},'')),patch.object(profiles,'load_profile',return_value={'fallback_when_challenge':['playwright_mcp','playwright_real_chrome']}),patch.object(executor,'run_playwright_fallback',side_effect=browser) as run:
   result=adapter.fetch(TARGET,max_browser_attempts=1,enable_markdown=False);self.assertTrue(result.ok);self.assertEqual(run.call_count,2);self.assertEqual(result.executed_attempts,1)
 def test_terminal_wall_never_enters_surrogate_or_browser(self):
  failed=adapter.native.FetchResult(False,final_url=TARGET,verdict='auth_required')
  with patch.object(adapter.native,'fetch',return_value=failed),patch.object(adapter,'run_surrogate') as proxy:
   self.assertFalse(adapter.fetch(TARGET).ok);proxy.assert_not_called()
 def test_real_http_stream_headers_redirects_and_response_bounds(self):
  import threading
  from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
  received=[]
  class Handler(BaseHTTPRequestHandler):
   def do_GET(self):
    received.append((self.path,dict(self.headers)))
    if self.path=='/redirect':
     self.send_response(302);self.send_header('Location','/body');self.end_headers();return
    self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers();self.wfile.write(BODY.encode())
   def log_message(self,*args):pass
  server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();base='http://127.0.0.1:'+str(server.server_port)
  try:
   with patch.dict('os.environ',{'INSANE_ALLOW_PRIVATE':'1'}):
    response=surrogate.public_request(base+'/redirect',timeout=3);self.assertEqual(response.text,BODY);self.assertTrue(response.url.endswith('/body'))
    with patch.object(surrogate,'MAX_RESPONSE_BYTES',128):
     with self.assertRaises(ValueError):surrogate.public_request(base+'/body',timeout=3)
    for _,headers in received:
     self.assertNotIn('Cookie',headers);self.assertNotIn('Authorization',headers)
   with patch.dict('os.environ',{'INSANE_ALLOW_PRIVATE':'0'}):
    before=len(received)
    with self.assertRaises(ValueError):surrogate.public_request(base+'/body',timeout=3)
    self.assertEqual(len(received),before)
   with self.assertRaises(ValueError):surrogate.public_request('https://user:secret@example.com/article',timeout=3)
  finally:server.shutdown();server.server_close();thread.join(2)
 def test_reader_cached_envelope_is_snapshot_not_live_or_false_timestamp(self):
  body='Title: Article\nURL Source: '+TARGET+'\nPublished Time: Fri, 09 Oct 2026 20:19:47 GMT\nWarning: This is a cached snapshot of the original page\nMarkdown Content:\n'+('Meaningful public article. '*8)
  response=surrogate.PublicResponse(200,body.encode(),'https://r.jina.ai/'+TARGET,{'content-type':'text/plain'})
  with patch.object(surrogate,'public_request',return_value=response):
   traces,metadata,text=surrogate.run_surrogate(TARGET,registry={'reader':{'kind':'reader','fetch':'https://r.jina.ai/{target}'}})
   self.assertTrue(text);self.assertEqual(metadata['provenance'],'snapshot');self.assertEqual(metadata['trust'],'archive');self.assertIsNone(metadata['snapshot_timestamp']);self.assertTrue(any('capture timestamp is unknown' in reason for reason in traces[-1].reasons))
  bad=surrogate.PublicResponse(200,body.replace(TARGET,'https://other.example/article').encode(),response.url,response.headers)
  with patch.object(surrogate,'public_request',return_value=bad):
   self.assertEqual(surrogate.run_surrogate(TARGET,registry={'reader':{'kind':'reader','fetch':'https://r.jina.ai/{target}'}})[2],'')
 def test_missing_live_page_can_still_retrieve_archive_without_browser(self):
  failed=adapter.native.FetchResult(False,final_url=TARGET,verdict='not_found',stop_reason='not_found')
  attempt=adapter.native.Attempt('surrogate','surrogate_fixture',TARGET,'original',None,'',status=200,verdict='weak_ok')
  with patch.object(adapter.native,'fetch',return_value=failed),patch.object(adapter,'run_surrogate',return_value=([attempt],{'provenance':'snapshot','trust':'archive','snapshot_timestamp':'20261011000000'},BODY)):
   result=adapter.fetch(TARGET);self.assertTrue(result.ok);self.assertEqual(result.provenance,'snapshot')
  encoded='https://example.com/a%2Fb?query=one%2Ftwo'
  self.assertTrue(surrogate._same_target(surrogate._snapshot_target('https://web.archive.org/web/20261011000000/'+encoded),encoded))
if __name__=='__main__':unittest.main()
