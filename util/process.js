import Bmp from './Bmp';
import { alaw } from 'alawmulaw';
import { fileOpen, fileSave } from 'browser-fs-access';
import { KaitaiStream } from 'kaitai-struct';
import toWav from 'audiobuffer-to-wav';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

function normalize8BitAudio(audioData) {
  const maxInt8Value = 127;
  const normalizedData = new Float32Array(audioData.length);

  for (let i = 0; i < audioData.length; i++) {
      // Convert 8-bit signed integer to floating-point value in the range -1 to 1
      normalizedData[i] = (audioData[i]) / maxInt8Value;
  }

  return normalizedData;
}

function denormalize8BitAudio(audioData) {
  const maxInt8Value = 127;
  const denormalizedData = new Int8Array(audioData.length);

  for (let i = 0; i < audioData.length; i++) {
      // Convert floating-point value in the range -1 to 1 to 8-bit signed integer
      denormalizedData[i] = Math.round((audioData[i]) * maxInt8Value);
  }

  return denormalizedData;
}

function normalize16BitAudio(audioData) {
  const maxInt16Value = 32767;
  const normalizedData = new Float32Array(audioData.length);

  for (let i = 0; i < audioData.length; i++) {
      // Convert 16-bit unsigned integer to floating-point value in the range -1 to 1
      normalizedData[i] = audioData[i] / maxInt16Value;
  }

  return normalizedData;
}

function denormalize16BitAudio(audioData) {
  const maxInt16Value = 32767;
  const denormalizedData = new Int16Array(audioData.length);

  for (let i = 0; i < audioData.length; i++) {
      // Convert floating-point value in the range -1 to 1 to 16-bit signed integer
      denormalizedData[i] = Math.round(audioData[i] * maxInt16Value);
  }

  return denormalizedData;
}

function applyFuncRegion(data, region, func){
  const conversionFactor = data.length / region[2];
  const startIdx = Math.round(region[0] * conversionFactor);
  const endIdx = Math.round(region[1] * conversionFactor);

  const before = data.slice(0, startIdx);
  const middle = data.slice(startIdx, endIdx + 1);
  const after = data.slice(endIdx+1);

  return func(before, middle, after);
}

export function deleteRegion(data, region, block_length = 4){
  const del = (b,m,a) => {
    const remainder = (b.length + a.length) % block_length;
    return  [...b, ...m.slice(0,remainder), ...a];
  };

  return applyFuncRegion(data, region, del);
}

export function reverseRegion(data, region, block_length = 4){
  const rev = (b,m,a) => {
    return  [...b, ...m.reverse(), ...a];
  };

  return applyFuncRegion(data, region, rev);
}

export function amplifyRegion(data, region, multiplier){
  const rev = (b,m,a) => {
    const amp = m.map((x) => Math.min(Math.max(x * multiplier, -1.0), 1.0));
    return  [...b, ...amp, ...a];
  };

  return applyFuncRegion(data, region, rev);
}

export async function openBMP(){
  try{
    const blob = await fileOpen({
      mimeTypes: ['image/bmp'],
    });
    return blob;
  }
  catch (err) {
    console.error(err.name, err.message);
  }
}

export async function openWAV(){
  try{
    const blob = await fileOpen({
      mimeTypes: ['audio/wav'],
    });
    return blob;
  }
  catch (err) {
    console.error(err.name, err.message);
  }
}

//Opens a BMP
export async function convertBMP(bmpData) {
    var parsedData = new KaitaiStream(bmpData);
    var parsedBMP = new Bmp(parsedData);
    
    var dims = [parsedBMP.dibInfo.header.imageWidth, parsedBMP.dibInfo.header.imageHeightRaw];
    
    //A-Law Encoding
    //var alawdecode = alaw.decode(new Uint8Array(bmpData).slice(parsedBMP.fileHdr.ofsBitmap));
    //var normal_audio = normalize16BitAudio(alawdecode);

    //No Encoding
    var normal_audio = normalize8BitAudio(new Int8Array(bmpData).slice(parsedBMP.fileHdr.ofsBitmap));

    var header = new Uint8Array(bmpData).slice(0, parsedBMP.fileHdr.ofsBitmap);

    return [header, normal_audio, dims];  
};

export async function convertToWAV(data, sampleRate = 24000) {
  const audioBuffer = new AudioBuffer({ length: data.length, numberOfChannels: 1, sampleRate });
  audioBuffer.copyToChannel(data, 0);

  // Convert AudioBuffer to WAV
  const wavBuffer = toWav(audioBuffer);
  return wavBuffer;
};

export async function saveWAVFile(data, name = 'output.wav', sampleRate = 24000) {
  const audioBuffer = new AudioBuffer({ length: data.length, numberOfChannels: 1, sampleRate });
  audioBuffer.copyToChannel(data, 0);

  // Convert AudioBuffer to WAV
  const wavBuffer = toWav(audioBuffer);

  try{
    // Save the WAV file (Node.js example)
    await fileSave( Buffer.from(wavBuffer), {
        fileName: name,
        extensions: ['.wav'],
    });
  }
  catch(error){
    console.log(error);
  }
};

export async function reprocessBMP(header, data){
  let buffer = Buffer.concat([
    Buffer.from(header.buffer),
    //No Encoding
    Buffer.from(new Int8Array(denormalize8BitAudio(data)).buffer)
    //A-Law Encoding
    //Buffer.from(alaw.encode(new Uint16Array(denormalize16BitAudio(data))).buffer)
  ]);
  return buffer;
}

export async function saveBMPFile(header, data, name = 'output.bmp') {
  //new BMP(new KaitaiStream(data))
  
  let buffer = reprocessBMP(header, data);

  try{
    // Save the WAV file (Node.js example)
    await fileSave( buffer, {
        fileName: name,
        extensions: ['.bmp'],
    });
  }
  catch(error){
    console.log(error);
  }
};