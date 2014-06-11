When updating the svg, update the pngs as well:

```bash
for i in 16 48 128; do
    convert -background none ingress.svg -resize $i $i.png
done

convert -background none ingress.svg ingress.png
```
