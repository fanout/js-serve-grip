import { GripInstruct } from '@fanoutio/grip';

export interface IResponseGrip {
    startInstruct: () => GripInstruct;
}
