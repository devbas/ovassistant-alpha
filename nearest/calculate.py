

import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import json 
import calculate2 
import sentry_sdk
import logging
sentry_sdk.init("https://29436939613d4654864055395fa84a2d@sentry.io/1339196")

HOST_NAME = '0.0.0.0'
PORT_NUMBER = 9001

class NearestVehicle(BaseHTTPRequestHandler):
  def do_HEAD(self):
    self.send_response(200)
    self.send_header('Content-type', 'text/html')
    self.end_headers()

  def do_GET(self):
    paths = {
      '/classify/location': {'status': 200}
    }

    o = urlparse(self.path) 
    if not o.path in paths:
      print('not all info avaialbe 2' + str(self.path) + str(o.path) + str(paths))
      self.respond({'status': 500})
      return 
    
    if not o.query: 
      print('not all info avaialbe 3')
      self.respond({'status': 500})
      return 
    
    variables = parse_qs(o.query)
    datetime = int(variables['datetime'][0])
    lon = float(variables['lon'][0])
    lat = float(variables['lat'][0])
    user_id = variables['user_id'][0]

    if not datetime or not lon or not lat or not user_id: 
      print('not all info avaialbe')
      self.respond({'status': 500})
      return 

    
    vehicles = calculate2.get_vehicle_candidates(lon, lat, int(datetime), user_id)
    self.send_response(200)  
    self.send_header('Content-type','text-html')  
    self.send_header('Access-Control-Allow-Origin','*')  
    self.end_headers()  
    self.wfile.write(str.encode(json.dumps(vehicles)))
    return 

  def handle_http(self, status_code):
    self.send_response(status_code)
    self.send_header('Content-type', 'text/html')
    self.end_headers()
    content = '''
      <html><head><title>OVAssistant Nearest Service.</title></head>
      <body><p>The system is OK.</p>
      </body></html>
      '''
    return bytes(content, 'UTF-8')

  def respond(self, opts):
    response = self.handle_http(opts['status'])
    self.wfile.write(response)

if __name__ == '__main__':
  server_class = HTTPServer
  httpd = server_class((HOST_NAME, PORT_NUMBER), NearestVehicle)
  print(time.asctime(), 'Server Starts - %s:%s' % (HOST_NAME, PORT_NUMBER))
  try:
      httpd.serve_forever()
  except KeyboardInterrupt:
      pass
  httpd.server_close()
  print(time.asctime(), 'Server Stops - %s:%s' % (HOST_NAME, PORT_NUMBER))