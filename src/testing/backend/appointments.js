// Kiebitz - Privacy-Friendly Appointments
// Copyright (C) 2021-2021 The Kiebitz Authors
// README.md contains license information.

import {
    hash,
    sign,
    verify,
    deriveToken,
    generateECDSAKeyPair,
    ephemeralECDHEncrypt,
    ecdhDecrypt,
    generateECDHKeyPair,
    randomBytes,
} from 'helpers/crypto';
import { copy } from 'helpers/store';
import { shuffle } from 'helpers/lists';
import { e } from 'helpers/async';

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// The appointments backend
export default class AppointmentsBackend {
    constructor(settings, store) {
        this._initialized = false;
        this.settings = settings;
        this.store = store;
        this.initialize();
    }

    async priorityToken(queueID, n) {
        return await e(deriveToken(queueID, this.secret, n));
    }

    async initialized() {
        let i = 0;
        while (!this._initialized) {
            await e(timeout(10));
            if (i++ > 100) {
                throw 'still not initialized';
            }
        }
    }

    async confirmProvider({ id, key, providerData, keyData }) {
        let found = false;
        const keyDataJSON = JSON.parse(keyData.data);
        const newProviders = [];
        for (const existingKey of this.keys.providers) {
            const existingKeyDataJSON = JSON.parse(existingKey.data);
            if (existingKeyDataJSON.signing === keyDataJSON.signing) {
                newProviders.push(keyData);
            } else {
                newProviders.push(existingKey);
            }
        }
        this.keys.providers = newProviders;
        this.store.set('keys', this.keys);
        // we store the verified provider data
        const result = await this.storeData(id, providerData);
        if (!result) return;
        return {};
    }

    // add the mediator key to the list of keys (only for testing)
    async addMediatorPublicKeys(keys) {
        await e(this.initialized());
        const keyData = {
            encryption: keys.encryption.publicKey,
            signing: keys.signing.publicKey,
        };
        const jsonData = JSON.stringify(keyData);
        const signedData = await e(
            sign(this.rootSigningKeyPair.privateKey, jsonData)
        );
        for (const data of this.keys.mediators) {
            if (data.data == signedData.data) {
                return;
            }
        }
        // we add the signed mediator key
        this.keys.mediators.push(signedData);
        this.store.set('keys', this.keys);
    }

    // returns the public root signing key (required to e.g. verify mediator keys)
    get rootSigningPublicKey() {
        return this.rootSigningKeyPair.publicKey;
    }

    // initializes the appointments testing backend
    async initialize() {
        // we generate a root signing key pair that will sign e.g. mediator keys
        let rootSigningKeyPair = this.store.get('rootSigningKeyPair');
        if (rootSigningKeyPair === null) {
            rootSigningKeyPair = await e(generateECDSAKeyPair());
            this.store.set('rootSigningKeyPair', rootSigningKeyPair);
        }

        let positions = this.store.get('queuePositions');

        if (positions === null) {
            positions = {};
            this.store.set('queuePositions', positions);
        }

        this.queuePositions = positions;

        this.rootSigningKeyPair = rootSigningKeyPair;

        let tokens = this.store.get('tokens');
        if (tokens === null) {
            tokens = {};
            this.store.set('tokens', tokens);
        }
        this.tokens = tokens;

        // the key pair for encrypting queue data
        let queueKeyEncryptionKeyPair = this.store.get(
            'queueKeyEncryptionKeyPair'
        );

        if (queueKeyEncryptionKeyPair === null) {
            queueKeyEncryptionKeyPair = await e(generateECDHKeyPair());
            this.store.set(
                'queueKeyEncryptionKeyPair',
                queueKeyEncryptionKeyPair
            );
        }

        this.queueKeyEncryptionKeyPair = queueKeyEncryptionKeyPair;

        // the key pair for encrypting queue data
        let tokenSigningKeyPair = this.store.get('tokenSigningKeyPair');

        if (tokenSigningKeyPair === null) {
            tokenSigningKeyPair = await e(generateECDSAKeyPair());
            this.store.set('tokenSigningKeyPair', tokenSigningKeyPair);
        }

        this.tokenSigningKeyPair = tokenSigningKeyPair;

        // the key pair for encrypting provider data
        let providerDataEncryptionKeyPair = this.store.get(
            'providerDataEncryptionKeyPair'
        );

        if (providerDataEncryptionKeyPair === null) {
            providerDataEncryptionKeyPair = await e(generateECDHKeyPair());
            this.store.set(
                'providerDataEncryptionKeyPair',
                providerDataEncryptionKeyPair
            );
        }

        this.providerDataEncryptionKeyPair = providerDataEncryptionKeyPair;

        // we generate a secret that will be used to generate priority tokens
        let secret = this.store.get('secret');
        if (secret === null) {
            secret = randomBytes(32);
            this.store.set('secret', secret);
        }

        this.secret = secret;

        const fixtures = this.settings.get('fixtures');
        let keys = this.store.get('keys');

        if (keys === null) {
            keys = {
                mediators: [],
                notifiers: [],
                providers: [],
            };
            this.store.set('keys', keys);
        }

        this.keys = keys;

        let queues = this.store.get('queues');

        if (queues === null) {
            const queuesFixtures = fixtures.get('queues');

            queues = [];
            for (let queue of queuesFixtures) {
                // we make a copy...
                queue = Object.assign({}, queue);
                // we generate an ID for each queue
                queue.id = randomBytes(32);
                // we generate a key for each queue
                queue.keyPair = await e(generateECDHKeyPair());
                // we encrypt the queue key with the queue encryption key pair
                // to which all mediators have access...
                [queue.encryptedPrivateKey, _] = await e(
                    ephemeralECDHEncrypt(
                        queue.keyPair.privateKey,
                        queueKeyEncryptionKeyPair.publicKey
                    )
                );
                const decrypted = await e(
                    ecdhDecrypt(
                        queue.encryptedPrivateKey,
                        queueKeyEncryptionKeyPair.privateKey
                    )
                );

                // we make sure the encryption & decryption works
                if (decrypted !== queue.keyPair.privateKey) throw 'uh oh';

                queues.push(queue);
            }
            this.store.set('queues', queues);
        }

        this.queues = queues;

        // and we're done!
        this._initialized = true;
    }

    // public endpoints

    async getQueues() {
        await e(this.initialized());
        return this.queues.map(queue => ({
            name: queue.name,
            type: queue.type,
            id: queue.id,
            publicKey: queue.keyPair.publicKey,
        }));
    }

    // return all public keys present in the system
    async getKeys() {
        await e(this.initialized());
        const keys = copy({
            // keys of providers and mediators
            lists: this.keys,
            // key to encrypt provider data for verification
            providerData: this.providerDataEncryptionKeyPair.publicKey,
            // root signing key (also provided via app)
            rootKey: this.rootSigningKeyPair.publicKey,
            // the token signing key (used by providers to verify a token hash)
            tokenKey: this.tokenSigningKeyPair.publicKey,
        });

        for (const providerKeys of keys.lists.providers) {
            providerKeys.json = JSON.parse(providerKeys.data);
        }
        for (const mediatorKeys of keys.lists.mediators) {
            mediatorKeys.json = JSON.parse(mediatorKeys.data);
        }

        return keys;
    }

    // data endpoints

    async deleteData(id, keyPair) {
        return this.store.remove(`data::${id}`);
    }

    async getData(id, keyPair) {
        // to do: implement access control (not really relevant though for the demo)
        return this.store.get(`data::${id}`);
    }

    async bulkGetData(ids, keyPair) {
        const results = [];
        for (const id of ids) {
            results.push(await this.getData(id, keyPair));
        }
        return results;
    }

    async bulkStoreData(keyPair, dataList) {
        const results = [];
        for (const data of dataList) {
            try {
                const result = await e(
                    this.storeData(
                        data.id,
                        data.data,
                        keyPair,
                        data.permissions
                    )
                );
                results.push(result);
            } catch (e) {
                results.push(null);
            }
        }
    }

    // store provider data for verification
    async storeData(id, data, keyPair, permissions, grant) {
        this.store.set(`data::${id}`, data);
        return true;
    }

    // user endpoints

    // get a token for a given queue
    async getToken(hash, encryptedData, queueID, signedTokenData) {
        let queueData;
        if (signedTokenData !== undefined) {
            // to do: validate signature!
            let signedToken = JSON.parse(signedTokenData.data);
            if (
                !(await e(
                    verify(
                        [this.tokenSigningKeyPair.publicKey],
                        signedTokenData
                    )
                ))
            )
                throw 'signature does not match';
            const newTokens = {};
            for (const [qID, tokens] of Object.entries(this.tokens)) {
                const newTokensList = [];
                for (const et of tokens) {
                    if (et.token == signedToken.token) {
                        queueData = et;
                        continue;
                    }
                    newTokensList.push(et);
                }
                newTokens[qID] = newTokensList;
            }
            this.tokens = newTokens;
        }
        // seems we haven't found this token in any queue (or no existing token was given)...
        if (queueData === undefined) {
            let position = this.queuePositions[queueID];

            if (position === undefined) position = 0;

            this.queuePositions[queueID] = position + 1;
            this.store.set('queuePositions', this.queuePositions);

            const token = await e(this.priorityToken(queueID, position));
            const tokenData = {
                token: token,
                hash: hash,
            };
            const tokenDataJSON = JSON.stringify(tokenData);
            signedTokenData = await e(
                sign(this.tokenSigningKeyPair.privateKey, tokenDataJSON)
            );
            queueData = {
                token: token,
                position: position,
                encryptedData: encryptedData,
            };
        }

        let queueTokens = this.tokens[queueID];

        if (queueTokens === undefined) {
            queueTokens = [];
            this.tokens[queueID] = queueTokens;
        }

        queueTokens.push(queueData);
        this.store.set('tokens', this.tokens);

        return signedTokenData;
    }

    // retract a token from a given queue
    async retractToken(token) {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    // provider-only endpoints

    // get n tokens from the given queue IDs
    async getQueueTokens(n, queueIDs, keyPair) {
        // we update the tokens
        this.tokens = this.store.get('tokens', {});

        const tokens = [];
        // we shuffle the queue IDs to avoid starvation of individual queues
        shuffle(queueIDs);
        // we also always remove just one token from every eligible list to
        // avoid starvation of individual lists of tokens...
        while (tokens.length < n) {
            let addedTokens = 0;
            for (const queueID of queueIDs) {
                const queueTokens = this.tokens[queueID];
                if (queueTokens === undefined || queueTokens.length === 0)
                    continue;
                tokens.push({ token: queueTokens.shift(), queue: queueID });
                if (tokens.length === n)
                    // we've got enough tokens
                    return copy(tokens);
                addedTokens++;
            }
            if (addedTokens === 0) break;
        }
        const selectedTokens = [
            ...this.store.get('selectedTokens', []),
            ...tokens,
        ];

        // we persist the changes
        this.store.set('selectedTokens', selectedTokens);
        this.store.set('tokens', this.tokens);

        // no more tokens left
        return copy(tokens);
    }

    async storeProviderData(id, signedData, code) {
        const result = await this.storeData(id, signedData);
        if (!result) return;
        let providerDataList = this.store.get('providers::list');
        if (providerDataList === null) providerDataList = [];
        for (const pid of providerDataList) {
            if (id === pid) return;
        }
        providerDataList.push(id);
        // we update the provider data list
        this.store.set('providers::list', providerDataList);
    }

    // delete provider data stored for verification
    deleteProviderData(id) {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    // mark a given token as used using its secret
    markTokenAsUsed(token, secret) {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    // mediator-only endpoint

    async getQueuesForProvider(queueIDs) {
        queueIDs = new Set(queueIDs);
        await e(this.initialized());
        return this.queues
            .filter(queue => queueIDs.has(queue.id))
            .map(queue => ({
                name: queue.name,
                type: queue.type,
                id: queue.id,
                publicKey: queue.keyPair.publicKey,
                encryptedPrivateKey: queue.encryptedPrivateKey,
            }));
    }

    async getPendingProviderData(keyPairs, limit) {
        const providersList = this.store.get('providers::list');
        if (providersList === null) return [];
        const providers = [];
        for (const providerID of providersList) {
            const providerData = this.store.get(`data::${providerID}`);
            if (providerData === null) return [];
            providers.push(providerData);
        }
        return providers;
    }

    // simulates the background tasks that the normal operator backend would do
    backgroundTasks() {}
}
