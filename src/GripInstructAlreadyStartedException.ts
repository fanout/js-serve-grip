import { GripInstructException } from './GripInstructException';

export class GripInstructAlreadyStartedException extends GripInstructException {
    message = 'GripInstruct Already Started';
}
