import { randomBytes } from 'helpers/crypto';

// generate and return the (local) provider data
export async function providerData(state, keyStore, settings, data) {
    const backend = settings.get('backend');
    try {
        // we lock the local backend to make sure we don't have any data races
        await backend.local.lock();
        let providerData = backend.local.get('provider::data');
        if (providerData === null) {
            providerData = {
                id: randomBytes(32),
                verifiedID: randomBytes(32),
                data: {},
            };
        }
        if (data !== undefined) providerData.data = data;
        backend.local.set('provider::data', providerData);
        return {
            status: 'loaded',
            data: providerData,
        };
    } finally {
        backend.local.unlock();
    }
}