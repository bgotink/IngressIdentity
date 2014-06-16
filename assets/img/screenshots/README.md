# Screenshots

To add a new screenshot, place it in `raw/`, then run

```
for i in raw/*
    convert $i -resize x740 -background '#e5e5e5' -gravity center -extent 1480x740 (echo $i | sed 's#raw/##')
end
```
