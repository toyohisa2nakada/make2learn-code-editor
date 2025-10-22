import { Canvas3D } from "../libs/Canvas3D.js";
async function init_Canvas3D() {
    await Canvas3D.init("libs/three.js-master.r176");
    await Canvas3D.init_canvas(document.body, {
        picking: true,
    });

    // test object
    const rect = document.body.getBoundingClientRect();
    const test_moving_by_manual_pos = [rect.width / 2, rect.height / 2 + 200, 0];
    const test_moving_by_manual_sz = [260, 60, 60];
    const test_moving_by_manual = await Canvas3D.createModelWithPhysics({
        view: { type: "box", sz: test_moving_by_manual_sz, color: 0xff0000, }, mass: 0, p: test_moving_by_manual_pos,
    });
    await Canvas3D.createModelWithPhysics({
        view: { type: "box", sz: test_moving_by_manual_sz, color: 0xff0000, }, mass: 0, p: test_moving_by_manual_pos,
    });
}
await init_Canvas3D();

const rigid_bodies = [];
async function add_3d_object_model({ p }) {
    const model_settings = [
        {
            url: `3d_models/chicken/scene.json?${Date.now()}`,
            model_collision_shape: "box",
            sz: [20, 36, 30],
        },
        {
            url: `3d_models/blender_dataset__kaggle/AmongUS/scene_${Math.trunc(Math.random() * 3 + 1)}.json?${Date.now()}`,
            model_collision_shape: "box",
            sz: [20, 36, 30],
        },
        // {
        //     url: `3d_models/suzuki_gsx_750/Srad_750.glb?${Date.now()}`,
        //     model_collision_shape: "box",
        //     sz: [20, 36, 30],
        // },
    ];
    const model = model_settings[Math.trunc(Math.random() * model_settings.length)];

    rigid_bodies.push(await Canvas3D.createModelWithPhysics({
        view: { type: "model", ...model },
        mass: 1, p: p.map((e, i) => i === 0 ? 200 : e), quat: [[0, 1, 0], Math.PI], ani_no: 3,
        attitude_control_values: { q1: { axis: [0, 1, 0], rad: Math.PI }, av1: [0, 0, 0], persist: true },
        update: p => {

            if (p.removed) {
                const idx = rigid_bodies.indexOf(p.obj);
                if (idx !== -1) {
                    rigid_bodies.splice(idx, 1);
                }
                return;
            }

            // アニメーション番号一覧
            // 番号: 動き
            // 0:足踏み(その場で歩き)
            // 1:歩き(前に移動を繰り返す)
            // 2:餌をついばむ
            // 3:軽く上下するだけで特に大きな変化はない
            // 4:走る(その場で走る)
            // 5:走る(前に移動を繰り返す)
            // 6:左右を見る
            // 7:0と同じ
            // 8:4と同じ

            const cur_ani_no = p.obj.userData.objThree?.ani_ctrl?.get_current_animation();
            const next_ani_no = Math.trunc(p.elapsed_time / 10) % 2 === 0 ? 6 : 3;
            if (/*cur_ani_no &&*/ cur_ani_no !== next_ani_no) {
                p.obj.userData.objThree.ani_ctrl.play_animation({ ani_no: next_ani_no });
            }
        },
    }));
}

export const physics = {
    render: function () {
        Canvas3D.render();
    },
    add_3d_object_model: async function (params) {
        await add_3d_object_model(params)
    },
};
