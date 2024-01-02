//import fs from 'fs';
import { convertBMP, saveWAVFile, saveBMPFile, deleteRegion, reverseRegion, amplifyRegion, openBMP, openWAV, reprocessBMP, convertToWAV} from '../../util/process';
import * as mm from 'music-metadata/lib/core';
import { Button } from '@mantine/core';
import { WaveSurferPlayer } from '../Wavesurfer/Wavesurfer';
import { Container, Space, Slider } from '@mantine/core';
import { useState, useRef, useEffect } from "react";
import styles from './bmpstyle.module.css';

export default function BMPDisplay() {
    //Start, End, Total Duration
    const [region, setRegion] = useState([0,2,2]);
    const [headerData, setHeader] = useState(null);
    const [audioData, setAudio] = useState(null);
    const [sampleRate, setSR] = useState(24000);
    const [imageData, setImage] = useState(null);
    const [url, setUrl] = useState(null);
    const [ampSlider, setAmp] = useState(-2);
    const [refresh, setRefresh] = useState(0);
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [dims, setDims] = useState([0,0]);

    const reloadWAV = async (audio) => {
        setAudio(audio);
        convertToWAV(audio, sampleRate).then((wavData) => {
            let blob = new Blob([wavData], {type: 'audio/wav'});
            setUrl(URL.createObjectURL(blob));
            setRefresh(refresh+1);
        });
        return "Done";
    }

    const reloadWAVwithSR = async (audio, sr) => {
        setAudio(audio);
        convertToWAV(audio, sr).then((wavData) => {
            let blob = new Blob([wavData], {type: 'audio/wav'});
            setUrl(URL.createObjectURL(blob));
            setRefresh(refresh+1);
        });
        return "Done";
    }

    const updateRegion = (start, end, duration) => {
        setRegion([start,end,duration]);
      } ;

    const loadBMP = async () => {
        try{
            let data = await openBMP();
            let bmpData = await data.arrayBuffer();
            convertBMP(bmpData).then(async (data) => {
                setHeader(data[0]);
                reloadWAV(data[1]);
                setDims(data[2]);
                let bmpImage = await reprocessBMP(data[0], data[1]);
                setImage(bmpImage);
            });
        }
        catch(error){
            console.log(error);
        }
    }

    function convertToUIntArr(num){
        var b1 = num & 0xff;
        var b2 = (num>>>8) & 0xff;
        var b3 = (num>>>16) & 0xff;
        var b4 = (num>>>24) & 0xff;
        return [b1, b2, b3, b4];
    }

    const loadWAV = async () => {
        try{
            let wavBlob = await openWAV();
            let wavData = await wavBlob.arrayBuffer();
            const metadata = await mm.parseBuffer(Buffer.from(wavData), {mimeType: 'audio/wav'});
            setSR(metadata.format.sampleRate);
            setUrl(URL.createObjectURL(wavBlob));
            setRefresh(refresh+1);
            //Uses metadata to find out sample rate and total number of samples
            //Calculates nearest square to crop output image to and then crops audio accordingly
            const nearestSquare = Math.floor(Math.sqrt(wavData.byteLength/8/3));
            const remain = (wavData.byteLength/8/3)-Math.pow(nearestSquare,2);
            let audioCtx = new AudioContext({sampleRate: metadata.format.sampleRate});
            let decodedData = await audioCtx.decodeAudioData(wavData.slice(0,-remain)); // audio is resampled to the AudioContext's sampling rate
            let float32Data = decodedData.getChannelData(0); // Float32Array for channel 0
            //Inserts the size into the proper locations for BMP header 
            let uIntSquare = convertToUIntArr(nearestSquare);
            let totalSize = convertToUIntArr(float32Data.length);
            let header = new Uint8Array([66, 77].concat(totalSize).concat([0, 0, 0, 0, 54, 0, 0, 0, 40, 0, 0, 0]).concat(uIntSquare).concat(uIntSquare).concat([1, 0, 24, 0, 0, 0, 0, 0]).concat(totalSize).concat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
            setHeader(header);
            reloadWAVwithSR(float32Data, metadata.format.sampleRate);
            setDims([nearestSquare, nearestSquare]);
            let bmpImage = await reprocessBMP(header, float32Data);
            setImage(bmpImage);
        }
        catch(error){
            console.log(error);
        }
    }

    const saveAudio = () => {
        try{
            saveWAVFile(new Float32Array(audioData), 'output.wav', sampleRate);
        }
        catch(error){
            console.log(error);
        }
        console.log("WAV Saved");
    }

    const saveImage = () => {
        try{
            saveBMPFile(headerData, audioData);
        }
        catch(error){
            console.log(error);
        }
        console.log("BMP Saved");
    }

    const delRegion = async () => {
        const newAudio = new Float32Array(deleteRegion(audioData, region));
        await reloadWAV(newAudio);
        reprocessBMP(headerData, newAudio).then((bmpData)=>{setImage(bmpData)});
        console.log("Region Deleted");
    }

    const revRegion = async () => {
        const newAudio = new Float32Array(reverseRegion(audioData, region));
        await reloadWAV(newAudio);
        reprocessBMP(headerData, newAudio).then((bmpData)=>{setImage(bmpData)});
        console.log("Region Reversed");
    }
    
    const ampRegion = async () => {
        const newAudio = new Float32Array(amplifyRegion(audioData, region, ampSlider));
        await reloadWAV(newAudio);
        reprocessBMP(headerData, newAudio).then((bmpData)=>{setImage(bmpData)});
        console.log("Region Amplified");
    }

    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = nativeEvent;
        contextRef.current.beginPath();
        contextRef.current.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const continueDrawing = ({ nativeEvent }) => {
        if (!isDrawing) return;

        const { offsetX, offsetY } = nativeEvent;
        contextRef.current.lineTo(offsetX, offsetY);
        contextRef.current.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        
        setIsDrawing(false);
        contextRef.current.closePath();
        const rawCanvasData = contextRef.current.getImageData(0, 0, dims[0], dims[1], { willReadFrequently: true }).data;
        const redData = rawCanvasData.filter((item, index) => (index + 1) % 4 == 1);
        const blueData = rawCanvasData.filter((item, index) => (index + 1) % 4 == 2);
        const greenData = rawCanvasData.filter((item, index) => (index + 1) % 4 == 3);
        const fullData = [];
        for(let i = 0; i < redData.length; i++){
            fullData.push(greenData[i]);
            fullData.push(blueData[i]);
            fullData.push(redData[i]);
        }
        
        const finalData = [];
        let offset = 0;
        //Goes from bottom to top to match BMP format
        for (let i = dims[1] - 1; i >= 0; i--){
            finalData.push(...fullData.slice(i*3*dims[0], i*3*dims[0]+dims[0]*3));
            //Padding, gets each row up to multiple of 4 bytes to fit BMP format
            for(let j = 0; j < dims[0] % 4; j++){
                finalData.push(0);
            }
        }

        let buffer = Buffer.concat([
            Buffer.from(headerData.buffer),
            Buffer.from(new Int8Array(finalData).buffer)
          ]);
        convertBMP(buffer).then(async (data) => {
            setHeader(data[0]);
            reloadWAV(data[1]);
            let bmpImage = await reprocessBMP(data[0], data[1]);
            setImage(bmpImage);
        });
    };

    //Reload Image when imageData changes
    useEffect(() => {
            if(headerData !== null && audioData !== null){
                // Create a new Uint8Array from the ArrayBuffer
                const byteArray = new Uint8Array(imageData);
                // Create a Blob from the ArrayBuffer
                const blob = new Blob([byteArray], { type: 'image/bmp' });
                // Create an Object URL from the Blob
                const objectUrl = URL.createObjectURL(blob);
                // Create an Image element
                const img = new Image();
                // Set the source of the Image element to the Object URL
                img.src = objectUrl;

                // Draw the image onto the canvas when it's loaded
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                //context.scale(.5, .5); // For high DPI screens
                context.lineCap = 'round';
                context.strokeStyle = 'black';
                context.lineWidth = 5;
                contextRef.current = context;

                img.onload = function () {
                    contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
                    contextRef.current.drawImage(img, 0, 0);
                };
            }
        }, [imageData]);

    return (
        <>
            <div style={{ display: 'flex', justifyContent:"center", margin:".5rem", height:'5vh' }}>
                <Space w="md"/>
                <Button onClick={loadBMP}>
                    Pick BMP
                </Button>
                <Space w="md"/>
                <Button onClick={loadWAV}>
                    Pick WAV
                </Button>
                <Space w="md"/>
                {headerData !== null &&
                <Button onClick={saveImage}>
                    Save Image
                </Button>}
                <Space w="md"/>
                {headerData !== null &&
                <Button onClick={saveAudio}>
                    Save Audio
                </Button>}
            </div>

            {headerData !== null && 
            <div className={styles.dataloaded}>
                <div className={styles.fcontainer}>
                    <div className={styles.fitem}>
                        <WaveSurferPlayer url={url} updateRegion={updateRegion} refresh={refresh} sampleRate={sampleRate} />

                        <Slider
                        style={{marginTop:"1rem", margin:".1rem"}}
                        label={(value) => `x ${(value-50)/25}`}
                        onChange={(x) => setAmp((x-50)/25)}
                        color="blue"
                        />
                    </div>
                    
                    <div className={styles.fitem}>
                        <Button onClick={ampRegion}>
                            Amplify
                        </Button>
                        <Space h="md"/>
                        <Button onClick={delRegion}>
                            Delete
                        </Button>
                        <Space h="md"/>
                        <Button onClick={revRegion}>
                            Reverse
                        </Button>
                    </div>
                </div>
                
                
                <div className={styles.fcontainer}>
                    <div className={styles.fitem}>
                        <canvas id="myCanvas" width={dims[0]} height={dims[1]} ref={canvasRef} 
                        onMouseDown={startDrawing}
                        onMouseMove={continueDrawing}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}></canvas>
                    </div>
                </div>
        
            </div>
            }
        </>
    );
}

