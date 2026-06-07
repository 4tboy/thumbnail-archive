const fs = require('fs');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

async function generatePng() {
  try {
    const svgFile = 'logo.svg';
    console.log(`Loading ${svgFile}...`);
    
    await sharp(svgFile)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile('icon.png');
      
    console.log('Fixed icon.png generated successfully!');
    
    const icoBuffer = await pngToIco('icon.png');
    fs.writeFileSync('icon.ico', icoBuffer);
    console.log('Fixed icon.ico generated successfully!');

  } catch (err) {
    console.error('Failed to fix icon:', err);
  }
}

generatePng();
