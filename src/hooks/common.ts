import { useNavigation } from "@react-navigation/native";
import { useEffect, useRef } from "react";

export type IIcon = {
    name: string,
    type: string
}

export function useScreenIcon(icon: IIcon): void {
    const navigation = useNavigation();

    useEffect(() => {
        navigation.setParams({ icon })
    }, []);
}


function usePrevious<T>(value: T) {
    // The ref object is a generic container whose current property is mutable ...
    // ... and can hold any value, similar to an instance property on a class
    const ref = useRef<T>();

    // Store current value in ref
    useEffect(() => {
        ref.current = value;
    }, [value]); // Only re-run if value changes

    // Return previous value (happens before update in useEffect above)
    return ref.current;
}