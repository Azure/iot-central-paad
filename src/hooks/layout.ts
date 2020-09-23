import { useState, useEffect } from "react";
import { Dimensions, ScaledSize } from "react-native";

type Orientation = 'portrait' | 'landscape';
function getOrientation(width: number, height: number): Orientation {
    if (width > height) {
        return 'landscape';
    }
    return 'portrait';
}

export function useScreenDimensions() {
    const [screenData, setScreenData] = useState(Dimensions.get('screen'));
    const [orientation, setOrientation] = useState<Orientation>(getOrientation(screenData.width, screenData.height));

    const onChange = (result: { window: ScaledSize, screen: ScaledSize }) => {
        setScreenData(result.window);
        const currentOrientation = getOrientation(result.window.width, result.window.height);
        if (orientation !== currentOrientation) {
            setOrientation(currentOrientation);
        }
    };

    useEffect(() => {
        Dimensions.addEventListener('change', onChange);
        return () => {
            Dimensions.removeEventListener('change', onChange);
        }
    }, [orientation]);
    return { screen: screenData, orientation };
}