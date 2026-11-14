"""Starts Nuqta's Alexa helper.

Run as:  python voice_helper.py -c <config.json> [-v|-vv|-vvv] [--salt TEXT]

--salt changes every device's identity, so Alexa treats them as brand-new
devices the next time it discovers. Nuqta bumps it for "Start fresh".
"""
import sys
import uuid


def main() -> None:
    args = sys.argv[1:]
    salt = ""
    if "--salt" in args:
        i = args.index("--salt")
        salt = args[i + 1] if i + 1 < len(args) else ""
        del args[i:i + 2]
    if salt:
        import fauxmo.fauxmo, fauxmo.protocols, fauxmo.utils   # noqa: E401
        original = fauxmo.utils.make_serial

        def salted(name: str) -> str:
            return original(f"{name}#{salt}")

        for mod in (fauxmo.utils, fauxmo.protocols, fauxmo.fauxmo):
            if hasattr(mod, "make_serial"):
                mod.make_serial = salted
    from fauxmo.cli import cli
    sys.argv = ["fauxmo", *args]
    cli()


if __name__ == "__main__":
    main()
