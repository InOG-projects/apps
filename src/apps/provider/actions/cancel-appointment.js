// Kiebitz - Privacy-Friendly Appointments
// Copyright (C) 2021-2021 The Kiebitz Authors
// README.md contains license information.

import { randomBytes, ephemeralECDHEncrypt } from 'helpers/crypto';

export async function cancelSlots(backend, slots, tokens) {
    if (backend !== undefined)
        tokens = backend.local.get('provider::tokens::open', []);
    for (const slot of slots) {
        if (slot.token !== undefined) {
            const existingToken = tokens.find(
                token => token.token === slot.token.token
            );
            if (existingToken !== undefined) {
                // we renew the grant IDs for the token, so the user can book another appointment
                existingToken.grantID = randomBytes(32);
                existingToken.cancelGrantID = randomBytes(32);
            }
        }
    }
    if (backend !== undefined)
        backend.local.set('provider::tokens::open', tokens);
}

export async function cancelAppointment(
    state,
    keyStore,
    settings,
    appointment
) {
    const backend = settings.get('backend');
    try {
        // we lock the local backend to make sure we don't have any data races
        await backend.local.lock();

        const openAppointments = backend.local.get(
            'provider::appointments::open',
            []
        );

        const otherAppointments = openAppointments.filter(
            ap => ap.id !== appointment.id
        );
        if (!openAppointments.find(ap => ap.id === appointment.id))
            return {
                status: 'failed',
            };

        await cancelSlots(backend, appointment.slotData);

        // we simply remove all slots
        appointment.slots = 0;
        appointment.slotData = [];

        // we push the modified appointment
        otherAppointments.push(appointment);
        backend.local.set('provider::appointments::open', otherAppointments);

        return {
            status: 'suceeded',
            data: otherAppointments,
        };
    } finally {
        backend.local.unlock();
    }
}

cancelAppointment.actionName = 'cancelAppointment';
