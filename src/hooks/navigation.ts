import { useNavigation } from "@react-navigation/native";
import { useEffect } from "react";

type IIcon = {
    name: string,
    type: string
}

export function useScreenIcon(icon: IIcon): void {
    const navigation = useNavigation();

    useEffect(() => {
        navigation.setParams({ icon })
    }, []);
}
