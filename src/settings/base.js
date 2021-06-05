// Kiebitz - Privacy-Friendly Appointments
// Copyright (C) 2021-2021 The Kiebitz Authors
// README.md contains license information.

/* global COMMIT_SHA */
//our own styles

import Settings from 'helpers/settings';
import logo from 'assets/images/logo.png';
import smallLogo from 'assets/images/logo-small.png';
import whiteLogo from 'assets/images/logo-white.png';
import smallWhiteLogo from 'assets/images/logo-small-white.png';
import routes from 'routes';
import baseSettings from './base';
import siLogo from 'assets/images/si-logo.png';

const settings = new Settings([
    ['title', 'Kiebitz'],
    ['logo', siLogo],
    ['whiteLogo', siLogo],
    ['smallWhiteLogo', siLogo],
    ['apps', new Map([])],
    ['menu', new Map([])],
    ['routes', routes],
    ['lang', 'de'],
    ['showTitles', true],
    ['commitSHA', COMMIT_SHA],
]);

export default settings;
