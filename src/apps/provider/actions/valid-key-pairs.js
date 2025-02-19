// Kiebitz - Privacy-Friendly Appointments
// Copyright (C) 2021-2021 The Kiebitz Authors
// README.md contains license information.

import { hash } from 'helpers/crypto';

// make sure the keys are registered in the backend
export async function validKeyPairs(state, keyStore, settings, keyPairs, keys) {
    let found = false;
    for (const providerKeys of keys.lists.providers) {
        if (
            providerKeys.json.signing == keyPairs.signing.publicKey &&
            providerKeys.json.encryption == keyPairs.encryption.publicKey
        ) {
            found = true;
            break;
        }
    }
    return { valid: found };
}

validKeyPairs.actionName = 'validKeyPairs';
