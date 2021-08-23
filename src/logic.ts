export type JsonListLogic =
    null |
    number |
    string |
    boolean |
    {[key: string]: JsonListLogic} |
    [string, ...JsonListLogic[]];
