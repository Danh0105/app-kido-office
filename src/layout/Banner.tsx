import { useEffect, useState, useRef } from "react";

type Props = {
    images: string[];
};

export default function BannerSlider({ images }: Props) {
    const [index, setIndex] = useState(0);
    const [isHover, setIsHover] = useState(false);

    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    // ================= AUTO SLIDE =================
    useEffect(() => {
        if (isHover) return;

        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % images.length);
        }, 4000);

        return () => clearInterval(interval);
    }, [images.length, isHover]);

    // ================= HANDLERS =================
    const next = () => {
        setIndex((prev) => (prev + 1) % images.length);
    };

    const prev = () => {
        setIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // ================= SWIPE (mobile) =================
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
        const diff = touchStartX.current - touchEndX.current;

        if (diff > 50) next(); // swipe left
        if (diff < -50) prev(); // swipe right
    };

    return (
        <div
            className="
            relative w-full overflow-hidden rounded-2xl shadow-lg group

            h-[220px] sm:h-[300px] md:h-[400px] lg:h-[600px]
            "
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* SLIDES */}
            <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{
                    transform: `translateX(-${index * 100}%)`,
                }}
            >
                {images.map((img, i) => (
                    <img
                        key={i}
                        src={img}
                        className="
                            w-full flex-shrink-0

                            h-[220px] sm:h-[300px] md:h-[400px] lg:h-[600px]

                            object-cover object-center bg-black
                        "
                    />
                ))}
            </div>

            {/* GRADIENT */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

            {/* ARROWS */}
            <button
                onClick={prev}
                className="
                    flex lg:flex
                    absolute left-2 top-1/2 -translate-y-1/2
                    w-8 h-8 lg:w-10 lg:h-10
                    bg-black/40 text-white 
                    rounded-full 
                    items-center justify-center
                    opacity-80 lg:opacity-0 lg:group-hover:opacity-100
                    transition
                "
            >
                ‹
            </button>

            <button
                onClick={next}
                className="
                    flex lg:flex
                    absolute right-2 top-1/2 -translate-y-1/2
                    w-8 h-8 lg:w-10 lg:h-10
                    bg-black/40 text-white 
                    rounded-full 
                    items-center justify-center
                    opacity-80 lg:opacity-0 lg:group-hover:opacity-100
                    transition
                "
            >
                ›
            </button>

            {/* DOTS */}
            <div className="absolute bottom-2 lg:bottom-3 w-full flex justify-center gap-2">
                {images.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setIndex(i)}
                        className={`
                            h-2 rounded-full transition-all
                            ${i === index
                                ? "w-6 bg-white"
                                : "w-2 bg-white/50"}
                        `}
                    />
                ))}
            </div>
        </div>
    );
}