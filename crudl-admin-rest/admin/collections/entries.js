import { formatDate } from '../utils'

function transform(p, func) {
    return p.then(response => {
        return response.set('data', response.data.map(func))
    })
}

//-------------------------------------------------------------------
var listView = {
    path: 'entries',
    title: 'Blog Entries',
    actions: {
        list: function (req, connectors) {
            let entries = connectors.entries.read(req)
            /* here we add a custom column based on the currently logged-in user */
            let entriesWithCustomColumn = transform(entries, (item) => {
                item.is_owner = req.authInfo.user == item.owner
                return item
            })
            return entriesWithCustomColumn
        }
    },
}

listView.fields = [
    {
        name: 'id',
        label: 'ID',
    },
    {
        name: 'section',
        key: 'section_name',
        label: 'Section',
        sortable: true,
    },
    {
        name: 'category',
        key: 'category_name',
        label: 'Category',
        sortable: true,
    },
    {
        name: 'title',
        label: 'Title',
        main: true,
        sortable: true,
    },
    {
        name: 'status',
        key: 'status_name',
        label: 'Status',
        sortable: true,
    },
    {
        name: 'date',
        label: 'Date',
        sortable: true,
        sorted: 'descending',
        sortpriority: '2',
    },
    {
        name: 'sticky',
        label: 'Sticky',
        render: 'boolean',
        sortable: true,
        sorted: 'descending',
        sortpriority: '1',
    },
    {
        name: 'is_owner',
        label: 'Owner',
        render: 'boolean',
    },
    {
        name: 'counter_links',
        label: 'No. Links',
        render: 'number',
    },
    {
        name: 'counter_tags',
        label: 'No. Tags',
        render: 'number',
    },
]

listView.filters = {
    fields: [
        {
            name: 'section',
            label: 'Section',
            field: 'Select',
            props: (req, connectors) => connectors.sections_options.read(req).then(res => res.data),
        },
        {
            name: 'category',
            label: 'Category',
            field: 'Select',
            onChange: [
                {
                    in: 'section',
                    // setValue: '',
                    // setProps: (section) => {
                    //     return new Promise((resolve, reject) => {
                    //         window.setTimeout(() => {
                    //             resolve({
                    //                 readOnly: !section,
                    //                 helpText: !section ? 'In order to select a category, you have to select a section first' : 'Select a category',
                    //             })
                    //         }, 2000)
                    //     })
                    // }
                    setProps: section => ({
                        readOnly: !section,
                        helpText: !section ? 'In order to select a category, you have to select a section first' : 'Select a category',
                    }),
                }
            ],
            props: (req, connectors) => connectors.categories_options.read(req).then(res => res.data)
        },
        {
            name: 'status',
            label: 'Status',
            field: 'Select',
            props: {
                options: [
                    {value: '0', label: 'Draft'},
                    {value: '1', label: 'Online'}
                ]
            },
        },
        {
            name: 'date_gt',
            label: 'Published after',
            field: 'Date',
            /* simple date validation (please note that this is just a showcase,
            we know that it does not check for real dates) */
            validate: (value, allValues) => {
                const dateReg = /^\d{4}-\d{2}-\d{2}$/
                if (value && !value.match(dateReg)) {
                    return 'Please enter a date (YYYY-MM-DD).'
                }
            }
        },
        {
            name: 'sticky',
            label: 'Sticky',
            field: 'Select',
            props: {
                options: [
                    {value: 'true', label: 'True'},
                    {value: 'false', label: 'False'}
                ],
                helpText: 'Note: We use Select in order to distinguish false and none.'
            }
        },
        {
            name: 'search_summary',
            label: 'Search (Summary)',
            field: 'Search',
        },
    ]
}

listView.search = {
    name: 'search',
}

//-------------------------------------------------------------------
var changeView = {
    path: 'entries/:id',
    title: 'Blog Entry',
    actions: {
        get: function (req, connectors) { return connectors.entry(req.id).read(req) },
        delete: function (req, connectors) { return connectors.entry(req.id).delete(req) },
        save: function (req, connectors) { return connectors.entry(req.id).update(req) },
    },
    validate: function (values) {
        if ((!values.category || values.category == "") && (!values.tags || values.tags.length == 0)) {
            return { _error: 'Either `Category` or `Tags` is required.' }
        }
    }
}

changeView.fieldsets = [
    {
        fields: [
            {
                name: 'id',
                field: 'hidden',
            },
            {
                name: 'title',
                label: 'Title',
                field: 'Text',
                required: true,
            },
            {
                name: 'status',
                label: 'Status',
                field: 'Select',
                required: true,
                initialValue: '0',
                /* set options manually */
                props: {
                    options: [
                        {value: '0', label: 'Draft'},
                        {value: '1', label: 'Online'}
                    ]
                },
            },
            {
                name: 'section',
                label: 'Section',
                field: 'Select',
                /* we set required to false, although this field is actually
                required with the API. */
                required: false,
                /* get options via an API call: instead we could use
                connectors.sections_options (see listView.filters) */
                props: (req, connectors) => connectors.sections.read(req).then(res => ({
                    helpText: 'Select a section',
                    options: res.data.map(section => ({
                        value: section.id,
                        label: section.name,
                    }))
                }))
            },
            {
                name: 'category',
                label: 'Category',
                field: 'Autocomplete',
                required: false,
                props: {
                    showAll: true,
                    helpText: 'Select a category',
                },
                /* this field depends on section (so we add a watch function in
                order to react to any changes on the field section). */
                onChange: [
                    {
                        in: 'section',
                        setValue: '',
                        setProps: section => ({
                            readOnly: !section,
                            helpText: !section ? 'In order to select a category, you have to select a section first' : 'Select a category',
                        }),
                    }
                ],
                actions: {
                    select: (req, connectors) => {
                        return Promise.all(req.data.selection.map(item => {
                            return connectors.category(item.value).read(req)
                            .then(res => res.set('data', {
                                value: res.data.id,
                                label: res.data.name,
                            }))
                        }))
                    },
                    search: (req, connectors) => {
                        if (!req.context.section) {
                            return Promise.resolve({data: []})
                        } else {
                            return connectors.categories.read(req
                                .filter('name', req.data.query)
                                .filter('section', req.context.section))
                            .then(res => res.set('data', res.data.map(d => ({
                                value: d.id,
                                label: `<b>${d.name}</b> (${d.slug})`,
                            }))))
                        }
                    },
                },
            },
        ],
    },
    {
        title: 'Content',
        expanded: true,
        fields: [
            {
                name: 'date',
                label: 'Date',
                field: 'Date',
                required: true,
                initialValue: () => formatDate(new Date()),
                props: {
                    formatDate: formatDate
                }
            },
            {
                name: 'sticky',
                label: 'Sticky',
                field: 'Checkbox',
            },
            {
                name: 'summary',
                label: 'Summary',
                field: 'Textarea',
                validate: (value, allValues) => {
                    if (!value && allValues.status == '1') {
                        return 'The summary is required with status "Online".'
                    }
                }
            },
            {
                name: 'body',
                label: 'Body',
                field: 'Textarea',
                validate: (value, allValues) => {
                    if (!value && allValues.status == '1') {
                        return 'The summary is required with status "Online".'
                    }
                }
            },
            {
                name: 'tags',
                label: 'Tags',
                field: 'AutocompleteMultiple',
                required: false,
                props: {
                    showAll: false,
                    helpText: 'Select a tag',
                },
                actions: {
                    search: (req, connectors) => {
                        return connectors.tags_options.read(req.filter('name', req.data.query.toLowerCase()))
                        .then(res => res.set('data', res.data.options))
                    },
                    select: (req, connectors) => {
                        return Promise.all(req.data.selection.map(item => {
                            return connectors.tag(item.value).read(req)
                            .then(res => res.set('data', {
                                value: res.data.id,
                                label: res.data.name,
                            }))
                        }))
                    },
                },
            }
        ]
    },
    {
        title: 'Internal',
        expanded: false,
        fields: [
            {
                name: 'createdate',
                label: 'Date (Create)',
                field: 'Datetime',
                readOnly: true
            },
            {
                name: 'updatedate',
                label: 'Date (Update)',
                field: 'Datetime',
                readOnly: true
            },
            {
                name: 'owner',
                key: 'owner',
                label: 'Owner',
                field: 'Select',
                readOnly: true,
                initialValue: () => Crudl.authInfo.user,
                props: (req, connectors) => connectors.users_options.read(req).then(res => res.data)
            },
        ]
    }
]

changeView.tabs = [
    {
        title: 'Links',
        actions: {
            list: (req, connectors) => connectors.links.read(req.filter('entry', req.id)),
            add: (req, connectors) => connectors.links.create(req),
            save: (req, connectors) => connectors.link(req.data.id).update(req),
            delete: (req, connectors) => connectors.link(req.data.id).delete(req)
        },
        itemTitle: '{url}',
        fields: [
            {
                name: 'url',
                label: 'URL',
                field: 'URL',
                props: {
                    link: true,
                },
            },
            {
                name: 'title',
                label: 'Title',
                field: 'String',
            },
            {
                name: 'id',
                field: 'hidden',
            },
            {
                name: 'entry',
                field: 'hidden',
                initialValue: (context) => context.data.id,
            },
        ],
    },
]

//-------------------------------------------------------------------
var addView = {
    path: 'entries/new',
    title: 'New Blog Entry',
    fieldsets: changeView.fieldsets,
    validate: changeView.validate,
    actions: {
        add: function (req, connectors) { return connectors.entries.create(req) },
    },
}

//-------------------------------------------------------------------
module.exports = {
    listView,
    addView,
    changeView,
}
