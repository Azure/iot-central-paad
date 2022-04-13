// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useEffect, useRef, useState} from 'react';
import {
  AnimatedCircularProgress,
  AnimatedCircularProgressProps,
} from 'react-native-circular-progress';

const CircularProgress = React.memo<AnimatedCircularProgressProps>(
  ({size, width, tintColor, backgroundColor, fill, children}) => {
    const [rotation, setRotation] = useState(0);
    const [interval, setInterval] = useState(100);
    const run = useRef(true);
    const progress = fill || 80;

    useEffect(() => {
      const fn = () => {
        setRotation(cur => {
          if (cur === 360) {
            return 0;
          }
          return cur + 10;
        });
        setInterval(currentInterval =>
          run.current ? currentInterval + 100 : currentInterval - 100,
        );
        run.current = !run.current;
      };
      setTimeout(fn, interval);
    }, [interval]);

    return (
      <AnimatedCircularProgress
        size={size || 120}
        fill={progress}
        prefill={progress - 70}
        width={width || 5}
        rotation={rotation}
        tintColor={tintColor || '#000'}
        backgroundColor={backgroundColor || '#FFF'}>
        {children}
      </AnimatedCircularProgress>
    );
  },
);

export default CircularProgress;
