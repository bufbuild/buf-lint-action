# `buf-lint-action`

This [Action] enables you to [lint] Protobuf files with [Buf] in your GitHub Actions pipelines. If
it detects violations of your configured [lint rules][lint.rules], it automatically creates inline
comments under the rule-breaking lines in your `.proto` files.

![Per-line pull request comments](./static/img/lint.png)

## Usage

Here's an example usage of the `buf-lint` Action:

```yaml
on: pull_request # Apply to all pull requests
jobs:
  lint-protos:
    # Run `git checkout`
    - uses: actions/checkout@v2
    # install the `buf` CLI
    - uses: bufbuild/buf-setup-action@v0.5.0
    # Run linting
    - uses: bufbuild/buf-lint-action@v1
```

With this configuration, the `buf` CLI runs the lint checks specified in your [`buf.yaml`][buf-yaml]
configuration file. If any violations are detected, `buf-lint-action`

## Prerequisites

For `buf-lint-action` to work. you need to install the `buf` CLI in the GitHub Actions Runner first.
We recommend using the [`buf-setup`] Action to install it (as in the example [above](#usage)).

## Configuration

Parameter | Description | Default
:---------|:------------|:-------
`input` | The path of the [Input] you want to lint check | `.`
`buf_token` | The Buf [authentication token][token] used for private [Inputs][input] |

> These parameters are derived from [`action.yml`](./action.yml)

### Inputs

Some repositories are structured so that their `buf.yaml` is defined
in a sub-directory alongside their Protobuf sources, such as a `proto/`
directory. In this case, you can specify the relative `input` path.

```sh
$ tree
.
└── proto
    ├── acme
    │   └── weather
    │       └── v1
    │           └── weather.proto
    └── buf.yaml
```

```yaml
steps:
  - uses: actions/checkout@v2
  - uses: bufbuild/buf-setup-action@v0.5.0
  - uses: bufbuild/buf-lint-action@v1
    with:
      input: 'proto'
```

The `buf-lint` action is also commonly used alongside other `buf` actions,
such as [buf-breaking][2] and [buf-push][3].

[action]: https://docs.github.com/actions
[buf]: https://buf.build
[buf-breaking]: https://github.com/marketplace/actions/buf-breaking
[buf-push]: https://github.com/marketplace/actions/buf-push
[buf-setup]: https://github.com/bufbuild/buf-setup-action
[buf-yaml]: https://docs.buf.build/configuration/v1/buf-yaml
[input]: https://docs.buf.build/reference/inputs
[lint]: https://docs.buf.build/lint/usage
[lint.rules]: https://docs.buf.build/lint/rules
[token]: https://docs.buf.build/bsr/authentication#create-an-api-token
