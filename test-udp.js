const dgram = require('dgram');

// Create a simple UDP listener on your host
const server = dgram.createSocket('udp4');

server.on('error', (err) => {
  console.log(`Server error:\n${err.stack}`);
  server.close();
});

server.on('message', (msg, rinfo) => {
  console.log(`Received UDP packet from ${rinfo.address}:${rinfo.port}`);
  console.log(`Data length: ${msg.length} bytes`);
  
  // Check if it looks like Art-Net
  if (msg.length >= 18 && msg.toString('ascii', 0, 7) === 'Art-Net') {
    console.log('🎉 Art-Net packet detected!');
    console.log(`OpCode: 0x${msg.readUInt16LE(8).toString(16)}`);
    console.log(`Universe: ${msg.readUInt16LE(14)}`);
    
    // Show first few DMX values
    const dmxStart = 18;
    const dmxValues = [];
    for (let i = 0; i < 10; i++) {
      dmxValues.push(msg.readUInt8(dmxStart + i));
    }
    console.log(`First 10 DMX channels: ${dmxValues.join(', ')}`);
  } else {
    console.log(`Raw data: ${msg.toString('hex').substring(0, 32)}...`);
  }
  console.log('---');
});

server.on('listening', () => {
  const address = server.address();
  console.log(`🎛️ Art-Net test listener started on ${address.address}:${address.port}`);
  console.log('Waiting for Art-Net packets...');
});

server.bind(6454, '0.0.0.0');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\nShutting down Art-Net test listener...');
  server.close();
  process.exit(0);
});