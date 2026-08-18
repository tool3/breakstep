export default function Logo(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="137" height="150" viewBox="0 0 137 150" role="img"
            aria-labelledby="bs-overlaid" {...props}>
            <title id="bs-overlaid">Breakstep</title>
            <g transform="translate(20 13)">
                <g fill="#F38671">
                    <rect x="56" y="0" width="24" height="68" />
                    <rect x="0" y="100" width="96" height="24" />
                </g>
                <g fill="#75BEFE">
                    <rect x="0" y="68" width="24" height="30" />
                </g>

                <g fill="#141414">

                    <rect x="55" y="24" width="26" height="2" />
                    <rect x="55" y="48" width="26" height="2" />

                    <rect x="-1" y="68" width="26" height="5" />
                    <rect x="-1" y="74" width="26" height="2" />

                    <rect x="10" y="74" width="4" height="24" />

                </g>

                <g fill="#8AD184">
                    <rect x="0" y="0" width="80" height="24" />
                    <rect x="0" y="0" width="24" height="68" />
                    <rect x="0" y="50" width="76" height="24" />
                    <rect x="72" y="50" width="24" height="74" />
                    <rect x="0" y="100" width="86" height="24" />
                </g>
            </g>
        </svg>
    )
}