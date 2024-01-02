import WaveSurfer from 'wavesurfer.js';
import Regions from 'wavesurfer.js/dist/plugins/regions.js';
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from '@mantine/core';

// WaveSurfer hook
export const useWavesurfer = (containerRef, options) => {
    const [wavesurfer, setWavesurfer] = useState(null);
    //const audiofile = new Audio();
    //audiofile.controls = true;
    //audiofile.src = '/output.wav';
  
    // Initialize wavesurfer when the container mounts
    // or any of the props change
    useEffect(() => {
      if (!containerRef.current) return

      const regions = Regions.create();
  
      const ws = WaveSurfer.create({
        ...options,
        container: containerRef.current,
        plugins: [
        regions,
        ]
      });
      console.log(ws);

      ws.on('decode', () => {
        // Regions
        regions.addRegion({
          start: 0,
          end: 2,
          content: ' ',
          color: 'rgba(255,210,210,.4)',
          drag: true,
          resize: true,
        });
      });

  
      setWavesurfer(ws);
  
      return () => {
        ws.destroy()
      }
    }, [containerRef, options.refresh])
  
    return wavesurfer
  }
  
  // Create a React component that will render wavesurfer.
  // Props are wavesurfer options.
export const WaveSurferPlayer = (props) => {
    const containerRef = useRef()
    const [isPlaying, setIsPlaying] = useState(false);

    const wavesurfer = useWavesurfer(containerRef, props);
  
    // On play button click
    const onPlayClick = useCallback(() => {
      wavesurfer.isPlaying() ? wavesurfer.pause() : wavesurfer.play()
    }, [wavesurfer])
  
    // Initialize wavesurfer when the container mounts
    // or any of the props change
    useEffect(() => {
      if (!wavesurfer) return

      setIsPlaying(false);
  
      const subscriptions = [
        wavesurfer.on('play', () => setIsPlaying(true)),
        wavesurfer.on('pause', () => setIsPlaying(false)),
        wavesurfer.plugins[0].on('region-updated', (region) => {props.updateRegion(region.start, region.end, region.totalDuration)}),
        wavesurfer.plugins[0].on('region-created', (region) => {props.updateRegion(region.start, region.end, region.totalDuration)})
      ]
  
      return () => {
        subscriptions.forEach((unsub) => unsub())
      }
    }, [wavesurfer])
  
    return (
      <>
        <div ref={containerRef} style={{ minWidth:'300px', minHeight: '120px', }} />
  
        <Button onClick={onPlayClick} style={{ margin: '1rem' }}>
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
      </>
    )
  }