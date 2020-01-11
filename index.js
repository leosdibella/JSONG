(function() {
    'use strict';

    const reservedKeys = Object.freeze({
        __JSONG_DATE__: '__JSONG_DATE__',
        __JSONG_KEYCHAIN__: '__JSONG_KEYCHAIN__',
        __JSONG_REFERENCE_ID__: '__JSONG_REFERENCE_ID__',
        __JSONG_SERIALIZED__: '__JSONG_SERIALIZED__',
        __JSONG_PRIMITIVE__: '__JSONG_PRIMITIVE__',
        __JSONG_ARRAY__: '__JSONG_ARRAY__'
    });

    function isDate(value) {
        return value instanceof Date;
    }

    function isObject(value) {
        return typeof value === 'object' && value !== null;
    }

    function uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
      
          return v.toString(16);
        });
    }

    function getFrom(object, keychain) {
        if (!isObject(object) || !Array.isArray(keychain) || !keychain.length) {
            return;
        }
        
        let value = object;

        for (let i = 0; i < keychain.length; ++i) {
            value = value[keychain[i]];
        }

        return value;
    }

    function setAt(object, keychain, value) {
        if (!isObject(object) || !Array.isArray(keychain) || !keychain.length) {
            return;
        }

        let ref = object;
        
        for (let i = 0; i < keychain.length - 1; ++i) {
            ref = ref[keychain[i]];
        }

        ref[keychain[keychain.length - 1]] = value;
    }

    function getProps(object) {
        return isObject(object) ? Object.keys(object).filter(key => !reservedKeys[key]).map(key => object[key]) : [];
    }

    function getRef(property, refIds) {
        const ref = refIds[property.__JSONG_REFERENCE_ID__];

        if (!ref) {
            const newRef = property.__JSONG_ARRAY__ !== undefined ? [] : {};
            
            refIds[property.__JSONG_REFERENCE_ID__] = newRef;

            return newRef;
        }

        return ref;
    }

    function getKeychain(object, keychain) {
        return isObject(object) ? Object.keys(object).filter(key => !reservedKeys[key]).map(key => [...keychain, key]) : [];
    }

    function serialize(data) {
        if (isDate(data)) {
            return JSON.stringify({
                __JSONG_DATE__: data.getTime(),
                __JSONG_SERIALIZED__: true
            });
        }

        if (!isObject(data)) {
            return JSON.stringify(data);
        }

        const rootRefId = uuid();
        
        const serializeable = {
            __JSONG_SERIALIZED__: true,
            __JSONG_REFERENCE_ID__: rootRefId,
            __JSONG_KEYCHAIN__: []
        };

        if (Array.isArray(data)) {
            serializeable.__JSONG_ARRAY__ = [];
        }

        const root = serializeable.__JSONG_ARRAY__ || serializeable;
        const refs = new WeakMap();

        refs.set(data, rootRefId);

        const queue = getKeychain(data, []);

        while (queue.length) {
            const [keychain] = queue.splice(0, 1);
            const value = getFrom(data, keychain);

            const property = {
                __JSONG_KEYCHAIN__: keychain
            };

            if (isDate(value)) {
                property.__JSONG_DATE__ = value.getTime();
            } else if (!isObject(value)) {
                property.__JSONG_PRIMITIVE__ = value;
            } else if (isObject(value)) {
                const refId = refs.get(value);

                if (Array.isArray(value)) {
                    property.__JSONG_ARRAY__ = [];
                }

                if (!refId) {
                    const addKeys = getKeychain(value, keychain);

                    refs.set(value, uuid());

                    for (let i = 0; i < addKeys.length; ++i) {
                        queue.push(addKeys[i]);
                    }
                } else {
                    property.__JSONG_REFERENCE_ID__ = refId;
                }
            }

            setAt(root, keychain, property);
        }

        return JSON.stringify(serializeable);
    }

    function deserialize(jsong) {
        const parsed = globalThis.JSON.parse(jsong);

        if (!isObject(parsed) || !parsed.__JSONG_SERIALIZED__) {
            return parsed;
        }
        
        if (parsed.__JSONG_DATE__ !== undefined) {
            return new Date(parsed.__JSONG_DATE__);
        }

        const deserialized = parsed.__JSONG_ARRAY__ ? [] : {};

        const refIds = {
            [parsed.__JSONG_REFERENCE_ID__]: deserialized
        };

        const queue = getProps(parsed.__JSONG_ARRAY__ || parsed);

        while (queue.length) {
            const [top] = queue.splice(0, 1);

            if (top.__JSONG_DATE__ !== undefined) {
                setAt(deserialized, top.__JSONG_KEYCHAIN__, new Date(top.__JSONG_DATE__));
            } else if (top.__JSONG_PRIMITIVE__ !== undefined) {
                setAt(deserialized, top.__JSONG_KEYCHAIN__, top.__JSONG_PRIMITIVE__);
            } else if (top.__JSONG_REFERENCE_ID__ !== undefined) {
                const ref = getRef(top, refIds);
                const currentProps = getProps(ref);
                const Props = getProps(top.__JSONG_ARRAY__ || top);

                if (currentProps.length < Props.length) {
                    for (let i = 0; i < Props.length; ++i) {
                        queue.push(Props[i]);
                    }
                }

                setAt(deserialized, top.__JSONG_KEYCHAIN__, ref);
            }
        }

        return deserialized;
    }

    globalThis.JSONG = Object.freeze({
        serialize,
        deserialize
    });
})();