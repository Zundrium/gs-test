import type { GaussianSplattingMesh, Scene } from "@babylonjs/core";
import { ShaderMaterial, Texture, Vector3, Effect } from "@babylonjs/core";

export function applySplatWave(mesh: GaussianSplattingMesh, scene: Scene) {
	const material = mesh.material as ShaderMaterial;
	if (!material) {
		console.error("Cannot apply wave effect: mesh has no material.");
		return;
	}

	const setupWaveEffect = (effect: Effect) => {
		const vs = effect.getVertexShaderSource();
		const fs = effect.getFragmentShaderSource();

		if (!vs || !fs || vs.includes("uNoiseTexture")) {
			// Effect already applied or source not available
			return;
		}

		const modifiedVs =
			`
            uniform sampler2D uNoiseTexture;
            uniform float uTime;
            uniform vec3 uWaveParams; // x: amplitude, y: frequency, z: speed
        ` +
			vs.replace(
				/vec3 center = readCenter\(splatIndex\);/,
				`$&
             float noise = texture(uNoiseTexture, center.xz * uWaveParams.y).r;
             center.y += sin(noise * 6.28318 + uTime * uWaveParams.z) * uWaveParams.x;
            `,
			);

		const effectOptions = {
			attributes: effect.getAttributesNames(),
			uniformsNames: [...effect.getUniformsNames(), "uTime", "uWaveParams"],
			samplers: [...effect.getSamplers(), "uNoiseTexture"],
			defines: effect.getDefines(),
			onError: (effect: Effect, errors: string) => {
				console.error("Error compiling wave shader:", errors);
			},
		};

		const newEffect = new Effect(
			{
				vertexSource: modifiedVs,
				fragmentSource: fs,
				name: "splatWaveEffect",
			},
			effectOptions,
			scene.getEngine(),
		);

		material.setEffect(newEffect);

		const noiseTexture = new Texture("/img/perlin.png", scene);
		material.setTexture("uNoiseTexture", noiseTexture);
		material.setVector3("uWaveParams", new Vector3(0.1, 1.5, 0.5)); // amplitude, frequency, speed
		material.setFloat("uTime", 0);

		let time = 0;
		scene.onBeforeRenderObservable.add(() => {
			time += scene.getEngine().getDeltaTime() / 1000;
			material.setFloat("uTime", time);
		});
	};

	const originalEffect = material.getEffect();
	if (originalEffect) {
		setupWaveEffect(originalEffect);
	} else {
		material.onEffectCreatedObservable.addOnce((effect) => {
			setupWaveEffect(effect);
		});
	}
}
