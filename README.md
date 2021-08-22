JSON List Logic
===============

This is basically just an exercise I do just for fun and is not intended to
be used in production by *anyone*. It is unfinished and untested and probably
always will be (the existing tests only cover a tiny tiny bit and no edge
cases).

At first I tried to keep it from being turing complete (so execution time is
ensured to be limited). I tried to do this by keeping variables and predefined
functions in separate namespaces and not giving a way to directly execute a
lambda. But turns out even with an indirect way like with a pre-defined reduce
function you can still construct a y-combinator.

So it is turing complete, but it is (hopefully) sandboxed. Need to review all
built-in functions to ensure that. Also need it to isolate it from any
JavaScript specific behaviors that would be painful to replicate in other
languages.

License
-------

Don't know yet. Probably LGPL, maybe even (A)GPL. Definitely not more premissive
this time.
