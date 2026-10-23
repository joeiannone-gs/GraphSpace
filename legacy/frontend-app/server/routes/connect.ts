import { USER_ID } from '../constants';
import { sendAndHandle } from '../handle';


export async function emitConnect() {
    await sendAndHandle(`connect/${USER_ID}`)
}
