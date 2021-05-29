// Kiebitz - Privacy-Friendly Appointments
// Copyright (C) 2021-2021 The Kiebitz Authors
// README.md contains license information.

import React, { useEffect, useRef, useState } from 'react';
import {
    withSettings,
    withActions,
    Modal,
    CardContent,
    WithLoader,
    CardFooter,
    Button,
    T,
    A,
} from 'components';
import Wizard from './wizard';
import { providerData } from '../actions';

import t from './translations.yml';
import './verify.scss';

/*
Here the user has a chance to review all data that was entered before confirming
the setup. Once the button gets clicked, the system generates the QR
codes, encrypts the contact data and stores the settings in the storage backend.
*/
const Verify = withSettings(
    withActions(
        ({ settings, providerData, providerDataAction }) => {
            const [initialized, setInitialized] = useState(false);

            useEffect(() => {
                if (initialized) return;
                providerDataAction();
                setInitialized(true);
            });

            console.log(providerData);

            const render = () => (
                <React.Fragment>
                    <CardContent>
                        <p className="kip-verify-notice">
                            <T
                                t={t}
                                k="verify.text"
                                link={
                                    <A
                                        key="letUsKnow"
                                        external
                                        href={settings.get('supportEmail')}
                                    >
                                        <T
                                            t={t}
                                            k="wizard.letUsKnow"
                                            key="letUsKnow"
                                        />
                                    </A>
                                }
                            />
                        </p>
                        <div className="kip-contact-data-box">
                            <ul>
                                <li>
                                    <span>
                                        <T t={t} k="provider-data.name" />
                                    </span>{' '}
                                    {providerData.data.name}
                                </li>
                                <li>
                                    <span>
                                        <T t={t} k="provider-data.email" />
                                    </span>{' '}
                                    {providerData.data.email || (
                                        <T t={t} k="provider-data.not-given" />
                                    )}
                                </li>
                            </ul>
                        </div>
                        <div className="kip-contact-data-links">
                            <A
                                className="bulma-button bulma-is-small"
                                href="/provider/setup/enter-contact-data"
                            >
                                <T t={t} k="contact-data.change" />
                            </A>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            type="success"
                            href={`/provider/setup/finalize`}
                        >
                            <T t={t} k="wizard.continue" />
                        </Button>
                    </CardFooter>
                </React.Fragment>
            );
            return (
                <WithLoader resources={[providerData]} renderLoaded={render} />
            );
        },
        [providerData]
    )
);

export default Verify;